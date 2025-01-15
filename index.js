require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

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

    // user data get
    app.get("/userData/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // create bioData
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
      const query = { email: email };
      const updateStatus = await userCollection.updateOne(query, {
        $set: { status: "registered" },
      });

      const result = await bioDataCollection.insertOne(bioData);
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
