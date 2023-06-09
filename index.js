const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const PORT = process.env.PORT || 3001;
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

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
    const classesCollection = client
      .db("pixelLensAcademyDB")
      .collection("classes");

    // Users routes
    app.get("/users", async (req, res) => {
      const users = await usersCollection.find({}).toArray();
      res.send(users);
    });

    // get a user using email
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = {email: email};
      const user = await usersCollection.findOne(query);
      res.send(user);
    });

    // get a user using id
    app.get("/users/id/:id", async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const user = await usersCollection.findOne(query);
      res.send(user);
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

    // check userType
    app.get("/user-type/:email", async (req, res) => {
      const email = req.params.email;
      if (!email) {
        return res.status(400).send({error: true, message: "missing email"});
      }
      const query = {email: email};
      const user = await usersCollection.findOne(query);
      const result = {userType: user?.userType};
      res.send(result);
    });

    // check admin
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;

      const query = {email: email};
      const user = await usersCollection.findOne(query);
      const result = {admin: user?.userType === "admin"};
      res.send(result);
    });

    // get all classes as admin
    app.get("/admin/:email/classes", async (req, res) => {
      const classes = await classesCollection.find({}).toArray();
      res.send(classes);
    });

    // update a class
    app.patch("/admin/:email/classes/:id", async (req, res) => {
      // find a class using id and update class status
      const {id} = req.params;
      const {status, feedback} = req.body;

      if (!id) {
        return res.status(400).send({error: true, message: "missing id"});
      }
      if (!status || !feedback) {
        return res.status(400).send({error: true, message: "missing body"});
      }
      const singleClass = await classesCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!singleClass) {
        return res.status(404).send({error: true, message: "Class not found"});
      }

      const updateDoc = {
        $set: {
          status: status,
          feedback: feedback,
        },
      };
      const result = await classesCollection.updateOne(
        {_id: new ObjectId(id)},
        updateDoc
      );
      res.send(result);
    });

    // make an admin using existing user account
    app.patch("/admin/:id", async (req, res) => {
      const {id} = req.params;
      if (!id) {
        return res.status(400).send({error: true, message: "missing id"});
      }
      const user = await usersCollection.findOne({_id: new ObjectId(id)});
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

    // get all instructors
    app.get("/instructors", async (req, res) => {
      const instructors = await usersCollection
        .find({
          userType: "instructor",
        })
        .toArray();
      res.send(instructors);
    });

    // check instructor
    app.get("/instructor/:email", async (req, res) => {
      const email = req.params.email;

      const query = {email: email};
      const user = await usersCollection.findOne(query);
      const result = {instructor: user?.userType === "instructor"};
      res.send(result);
    });

    // make an instructor using existing user account
    app.patch("/instructor/:id", async (req, res) => {
      const {id} = req.params;

      if (!id) {
        return res.status(400).send({error: true, message: "missing id"});
      }
      const user = await usersCollection.findOne({_id: new ObjectId(id)});
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

    // get all approved classes
    app.get("/classes", async (req, res) => {
      const query = {status: "approved"};
      const classes = await classesCollection.find(query).toArray();
      res.send(classes);
    });

    // get a approved classes
    app.get("/classes/:id", async (req, res) => {
      const id = req.params.id;
      if (!id) {
        return res.status(400).send({error: true, message: "missing id"});
      }
      const query = {status: "approved", _id: new ObjectId(id)};
      const classes = await classesCollection.find(query).toArray();
      res.send(classes);
    });

    // post classes
    app.post("/classes", async (req, res) => {
      const classData = req.body;
      if (!classData?.instructorId) {
        return res.status(400).send({error: true, message: "error is ocurred"});
      }
      const result = await classesCollection.insertOne(classData);
      res.send(result);
    });

    // get classes using instructor id
    app.get("/classes/:instructorId", async (req, res) => {
      const instructorId = req.params.instructorId;
      const query = {instructorId: instructorId};
      const classes = await classesCollection.find(query).toArray();
      res.send(classes);
    });

    // TODO: here now show approved classes but will be popular classes using enrolled student show minimum 6 classes
    // popular classes
    app.get("/popular-classes", async (req, res) => {
      const query = {status: "approved"};
      const classes = await classesCollection.find(query).toArray();
      res.send(classes);
    });

    // add selectedClasses in users collection as a student
    app.patch("/selected-classes/:id", async (req, res) => {
      const {id} = req.params;
      const {selectedClass} = req.body;

      if (!id || !selectedClass) {
        return res
          .status(400)
          .send({error: true, message: "missing id or selectedClass"});
      }

      const user = await usersCollection.findOne({_id: new ObjectId(id)});

      if (!user) {
        return res.status(404).send({error: true, message: "user not found"});
      }

      // Initialize selectedClasses as an empty array if it doesn't exist
      if (!user.selectedClasses) {
        user.selectedClasses = [];
      }

      // Check if selectedClass already exists in selectedClasses array
      const alreadyExists = user.selectedClasses.includes(selectedClass);

      if (!alreadyExists) {
        // If it doesn't exist, add the value to the array
        user.selectedClasses.push(selectedClass);
      }

      const updateDoc = {
        $set: {
          selectedClasses: user.selectedClasses,
        },
      };

      const result = await usersCollection.updateOne(
        {_id: new ObjectId(id)},
        updateDoc
      );

      res.send(result);
    });

    // Payment Method using stripe
    app.post("/create-payment-intent", async (req, res) => {
      const {price} = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
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
