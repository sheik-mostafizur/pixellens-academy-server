const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const PORT = process.env.PORT || 3001;

// middleware
app.use(cors());
app.use(express.json());

const {MongoClient, ServerApiVersion} = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.p7e2eey.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("pixelLensAcademyDB").collection("users");

    // Users routes
    app.get("/users", async (req, res) => {
      const users = await usersCollection.find({}).toArray();
      res.send(users);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      if (!user.email) {
        return res
          .status(400)
          .send({error: true, message: "missing email"});
      }
      const userExists = await usersCollection.findOne({email: user.email});
      if (userExists) {
        return res
          .status(400)
          .send({error: true, message: "user already exists"});
      }
      const newUser = await usersCollection.insertOne(user);
      res.send(newUser);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ping: 1});
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("pixelLens Academy...");
});

app.listen(PORT, () => {
  console.log(`Server is running part at http://localhost:${PORT}`);
});
