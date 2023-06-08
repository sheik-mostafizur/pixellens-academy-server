const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const PORT = process.env.PORT || 3001;

// middleware
app.use(cors());
app.use(express.json());

const {MongoClient, ServerApiVersion, ObjectId} = require("mongodb");
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
        return res.status(400).send({error: true, message: "missing email"});
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

    // check userTeype
    app.get("/users/user-type/:email", async (req, res) => {
      const email = req.params.email;

      const query = {email: email};
      const user = await usersCollection.findOne(query);
      const result = {userType: user.userType};
      res.send(result);
    });

    // check admin
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;

      const query = {email: email};
      const user = await usersCollection.findOne(query);
      const result = {admin: user?.userType === "admin"};
      res.send(result);
    });

    // make an admin using existing user account
    app.patch("/users/admin/:id", async (req, res) => {
      const {id} = req.params;
      console.log(id);
      if (!id) {
        return res.status(400).send({error: true, message: "missing id"});
      }
      const user = await usersCollection.findOne({_id: new ObjectId(id)});
      console.log(user);
      if (!user) {
        return res.status(404).send({error: true, message: "user not found"});
      }
      const updateDoc = {
        $set: {
          userType: "admin",
        },
      };

      const result = await usersCollection.updateOne(
        {_id: new ObjectId(id)},
        updateDoc
      );
      res.send(result);
    });

    // check instructor
    app.get("/users/instructor/:email", async (req, res) => {
      const email = req.params.email;

      const query = {email: email};
      const user = await usersCollection.findOne(query);
      const result = {instructor: user?.userType === "instructor"};
      res.send(result);
    });

    // make an instructor using existing user account
    app.patch("/users/instructor/:id", async (req, res) => {
      const {id} = req.params;
      console.log(id);
      if (!id) {
        return res.status(400).send({error: true, message: "missing id"});
      }
      const user = await usersCollection.findOne({_id: new ObjectId(id)});
      console.log(user);
      if (!user) {
        return res.status(404).send({error: true, message: "user not found"});
      }
      const updateDoc = {
        $set: {
          userType: "instructor",
        },
      };
      const result = await usersCollection.updateOne(
        {_id: new ObjectId(id)},
        updateDoc
      );
      res.send(result);
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
