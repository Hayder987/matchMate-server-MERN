require("dotenv").config();
const express = require("express");
const cookieParser = require('cookie-parser')
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 4000;

app.use(cors({
  origin: ["http://localhost:5173"],
  credentials:true
}));

app.use(express.json());
app.use(cookieParser());

const verifyToken=(req, res, next)=>{
  const token = req.cookies.token
  if(!token){
  return  res.status(401).send('UnAuthorized: Authentication credentials are missing')
  }

  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded)=>{
    if(err){
      return  res.status(401).send('UnAuthorized: Authentication credentials are inValid') 
    }

    req.user = decoded
    next()
  })

}


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
    
    // create token
    app.post('/jwt',(req, res)=>{
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {expiresIn:'3d'})
      res.cookie('token', token, {
        secure: process.env.NODE_ENV === 'production', 
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
      }).send({status:true})
    })

    // remove token
    app.post('/logout', (req, res)=>{
      res.clearCookie('token', {
        secure: process.env.NODE_ENV === 'production', 
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
      }).send({status:false})
    })

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

    // user data get private
    app.get("/userData/:email",verifyToken,  async (req, res) => {
      const email = req.params.email;
      if(req.user.email!==email){
        return res.status(403).send('Forbidden Access') 
      }
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // create bioData private
    app.post("/bioData", async (req, res) => {
      const bioData = req.body;
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
      if(req.user.email!==email){
        return res.status(403).send('Forbidden Access') 
      }
      const query = { email: email };
      const updateStatus = await userCollection.updateOne(query, {
        $set: { status: "registered" },
      });

      const result = await bioDataCollection.insertOne({
        ...bioData,
        type: "regular",
      });
      res.send(result);
    });
    
    // update user bio data private
    app.patch("/userBio/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if(req.user.email!==email){
        return res.status(403).send('Forbidden Access') 
      }
      const bioData = req.body
      const query = { email: email };
      const updateDoc = {
        $set: {
          biodataType: bioData.biodataType ,
          info:{
            name:bioData.info.name,
            fathername:bioData.info.fathername,
            mothername:bioData.info.mothername,
            height:bioData.info.height,
            weight:bioData.info.weight,
            race:bioData.info.race,
            age:bioData.info.age,
            birthDate:bioData.info.birthDate,
            presentDivision:bioData.info.presentDivision,
            permanentDivision:bioData.info.permanentDivision,
            occupation:bioData.info.occupation,
            mobileNumber:bioData.info.mobileNumber
          },
          expectedHeight:bioData.expectedHeight,
          expectedWeight:bioData.expectedWeight,
          partenerAge:bioData.partenerAge,
          image:bioData.image,
        },
      };
      const result = await bioDataCollection.updateOne(query, updateDoc)
      res.send(result)
    });

    // get bioData by email
    app.get("/userBio/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if(req.user.email !== email){
        return res.status(403).send('Forbidden Access')
      }
      const query = { email: email };
      const result = await bioDataCollection.findOne(query);
      res.send(result);
    });
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
