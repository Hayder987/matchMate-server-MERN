require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const Stripe = require("stripe");
const app = express();
const port = process.env.PORT || 4000;
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res
      .status(401)
      .send("UnAuthorized: Authentication credentials are missing");
  }

  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send("UnAuthorized: Authentication credentials are inValid");
    }

    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.7ya1e.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const userCollection = client.db("matchMateDB").collection("user");
    const bioDataCollection = client.db("matchMateDB").collection("bioData");
    const contactReqCollection = client
      .db("matchMateDB")
      .collection("contactReq");
      const reviewCollection = client.db("matchMateDB").collection("review");
    const favoriteCollection = client.db("matchMateDB").collection("favorite");

    // verify Admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.user.email;
      const query = { email: email };
      const userData = await userCollection.findOne(query);
      const isAdmin = userData.role === "admin";
      if (!isAdmin) {
        return res.status(403).send("forbidden Access");
      }
      next();
    };

    // create token
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "3d",
      });
      res
        .cookie("token", token, {
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ status: true });
    });

    // remove token
    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ status: false });
    });

    // user data post
    app.post("/userLogin", async (req, res) => {
      const user = req.body;
      const email = user.email;
      const query = { email: email };
      const isInclude = await userCollection.findOne(query);
      if (isInclude) {
        return res.send(isInclude);
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // request api to make user premium
    app.patch("/userPending/:email", verifyToken, async (req, res) => {
      const body = req.body;
      const email = req.params.email;
      if (req.user.email !== email) {
        return res.status(403).send("Forbidden Access");
      }
      const query = { email: email };
      const result = await userCollection.updateOne(query, {
        $set: { type: "pending", bioId: body.bioId, reqName: body.reqName },
      });
      res.send(result);
    });

    // user data get private
    app.get("/userData/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (req.user.email !== email) {
        return res.status(403).send("Forbidden Access");
      }
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // get premeium user data
    app.get("/premiumUser", async (req, res) => {
      const query = { type: "premium" };
      const age = req.query.age;
      const ageNumber = parseInt(age) || -1;

      const result = await userCollection
        .aggregate([
          {
            $match: query,
          },
          {
            $lookup: {
              from: "bioData",
              localField: "email",
              foreignField: "email",
              as: "bioDataInfo",
            },
          },
          {
            $unwind: {
              path: "$bioDataInfo",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              _id: 1,
              bioId: 1,
              reqName: 1,
              email: 1,
              type: 1,
              makeDate: 1,
              profileBioId: "$bioDataInfo._id",
              biodataType: "$bioDataInfo.biodataType",
              image: "$bioDataInfo.image",
              "info.permanentDivision": "$bioDataInfo.info.permanentDivision",
              "info.age": "$bioDataInfo.info.age",
              "info.occupation": "$bioDataInfo.info.occupation",
            },
          },
          {
            $sort: { "info.age": ageNumber },
          },
          {
            $limit: 6,
          },
        ])
        .toArray();

      res.send(result);
    });

    // post my favorite data
    app.post("/myFavorite", verifyToken, async (req, res) => {
      const favoriteData = req.body;
      const query = {
        serverId: favoriteData.serverId,
        email: favoriteData.email,
      };
      const isExist = await favoriteCollection.findOne(query);
      if (isExist) {
        return res.send({ status: true });
      }
      const result = await favoriteCollection.insertOne(favoriteData);
      res.send(result);
    });

    // get My Favorite Data with CI/CD Pipeline
    app.get("/myFavorite/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await favoriteCollection
        .aggregate([
          { $match: query },
          {
            $addFields: {
              serverIdAsObjectId: { $toObjectId: "$serverId" },
            },
          },
          {
            $lookup: {
              from: "bioData",
              localField: "serverIdAsObjectId",
              foreignField: "_id",
              as: "myFavoriteData",
            },
          },
          {
            $unwind: {
              path: "$myFavoriteData",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              name: "$myFavoriteData.info.name",
              bioDataId: "$myFavoriteData.bioId",
              permanentAddress: "$myFavoriteData.info.permanentDivision",
              occupation: "$myFavoriteData.info.occupation",
            },
          },
        ])
        .toArray();
      res.send(result);
    });

    // delete my Favorite Data
    app.delete("/myFavoriteItem/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await favoriteCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // create bioData private
    app.post("/bioData", verifyToken, async (req, res) => {
      const bioData = req.body;
      if (req.user.email !== bioData.email) {
        return res.status(403).send("Forbidden Access");
      }
      const lastBiodata = await bioDataCollection
        .find({})
        .sort({ bioId: -1 })
        .limit(1)
        .toArray();

      let bioId = 1;
      if (lastBiodata.length > 0) {
        bioId = lastBiodata[0].bioId + 1;
      }
      bioData.bioId = bioId;
      const email = bioData.email;
      const query = { email: email };
      const updateStatus = await userCollection.updateOne(query, {
        $set: { status: "registered" },
      });

      const result = await bioDataCollection.insertOne(bioData);
      res.send(result);
    });

    // update user bio data private
    app.patch("/userBio/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (req.user.email !== email) {
        return res.status(403).send("Forbidden Access");
      }
      const bioData = req.body;
      const query = { email: email };
      const updateDoc = {
        $set: {
          biodataType: bioData.biodataType,
          info: {
            name: bioData.info.name,
            fathername: bioData.info.fathername,
            mothername: bioData.info.mothername,
            height: bioData.info.height,
            weight: bioData.info.weight,
            race: bioData.info.race,
            age: bioData.info.age,
            birthDate: bioData.info.birthDate,
            presentDivision: bioData.info.presentDivision,
            permanentDivision: bioData.info.permanentDivision,
            occupation: bioData.info.occupation,
            mobileNumber: bioData.info.mobileNumber,
          },
          expectedHeight: bioData.expectedHeight,
          expectedWeight: bioData.expectedWeight,
          partenerAge: bioData.partenerAge,
          image: bioData.image,
        },
      };
      const result = await bioDataCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // get bioData by email
    app.get("/userBio/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (req.user.email !== email) {
        return res.status(403).send("Forbidden Access");
      }
      const query = { email: email };
      const result = await bioDataCollection.findOne(query);
      res.send(result);
    });

    // get bioData by id
    app.get("/singleBio/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bioDataCollection.findOne(query);
      res.send(result);
    });

    //  get similar bio with bioType
    app.get("/sameBio", async (req, res) => {
      const type = req.query.type;
      const query = { biodataType: type };
      const result = await bioDataCollection
        .find(query)
        .sort({ _id: 1 })
        .limit(3)
        .toArray();
      res.send(result);
    });

    // get biodata bye bioId
    app.get("/contactBiodata/:bioId", verifyToken, async (req, res) => {
      const bioId = parseInt(req.params.bioId);
      const query = { bioId: bioId };
      const result = await bioDataCollection.findOne(query);
      res.send(result);
    });

    // stripe setup--------------------------------------->
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
        // confirm: true,
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // cheackout request post api
    app.post("/cheackrequest", verifyToken, async (req, res) => {
      const reqInfo = req.body;
      const result = await contactReqCollection.insertOne({
        ...reqInfo,
        status: "pending",
      });
      res.send(result);
    });

    //  get my Req Data Api
    app.get("/contactReq/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await contactReqCollection
        .find({ ApplicantEmail: email })
        .toArray();
      res.send(result);
    });

    // delete my req data
    app.delete("/deleteMyReq/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await contactReqCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

  // add Review data
  app.post('/addReview', async(req, res)=>{
    const reviewData = req.body
    const result = await reviewCollection.insertOne(reviewData)
    res.send(result)
  })

    // admin api--------------------------------------------->

    // get all user Premium request
    app.get("/userPremiumReq", verifyToken, verifyAdmin, async (req, res) => {
      const query = { type: "pending" };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    // make user premium

    app.patch("/userReq/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.updateOne(query, {
        $set: { type: "premium", makeDate: new Date() },
      });
      res.send(result);
    });

    
    // make admin user
    app.patch("/makeAdmin/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.updateOne(query, {
        $set: { role: "admin" },
      });
      res.send(result);
    });

  // get all conctact req data
  app.get('/allContactReq', verifyToken, verifyAdmin, async(req, res)=>{
    const result = await contactReqCollection.find().sort({_id: -1}).toArray()
    res.send(result)
  })

  
  // approved contact req
  app.patch('/approvedContactReq/:id', verifyToken, verifyAdmin, async(req, res)=>{
    const id = req.params.id;
    const query = {_id: new ObjectId(id)}
    const result = await contactReqCollection.updateOne(query, {$set:{status:'approved'}})
    res.send(result)
  })

  // get pending All contact req lengt
  app.get('/allReqPending', verifyToken, verifyAdmin, async(req, res)=>{
    const query = {status:"pending"}
    const count = await contactReqCollection.countDocuments(query)
    res.send({count})
  })

  // get All User
  app.get('/allUserData', verifyToken, verifyAdmin, async(req, res)=>{
     const result = await userCollection.find().sort({_id: -1}).toArray()
     res.send(result)
  })

  // get all admin route data length
  app.get('/allInformation', verifyToken, verifyAdmin, async(req, res)=>{
    const totalBio = await bioDataCollection.countDocuments()
    const female = await bioDataCollection.countDocuments({biodataType:"Female"})
    const male = await bioDataCollection.countDocuments({biodataType:"Male"})
    const premium = await userCollection.countDocuments({type:"premium"})
    const totalRevenue = await contactReqCollection.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" } 
        }
      }
    ]).toArray();

    res.send({totalBio, female, male,premium, totalRevenue})
  })

  
  


  } finally {
    console.log(`Mongodb Running`);
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("MachMate server Running");
});

app.listen(port, () => {
  console.log(`MatchMate Server Running At Port: ${port}`);
});
