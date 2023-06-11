const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
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

// jwt authorization
const verifyJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_WEB_TOKEN);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).send("Unauthorized");
    }
  } else {
    res.status(401).send("Unauthorized");
  }
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("pixelLensAcademyDB").collection("users");
    const classesCollection = client
      .db("pixelLensAcademyDB")
      .collection("classes");
    const cartsCollection = client.db("pixelLensAcademyDB").collection("carts");
    const paymentCollection = client
      .db("pixelLensAcademyDB")
      .collection("payments");
    const enrollmentCollection = client
      .db("pixelLensAcademyDB")
      .collection("enrollments");

    // JWT post
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_WEB_TOKEN, {
        expiresIn: "1h",
      });
      res.send(token);
    });

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
    app.get("/user-type/:email", verifyJWT, async (req, res) => {
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
      const classes = await classesCollection
        .find({})
        .sort({status: -1})
        .toArray();
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
      if (!status) {
        return res.status(400).send({error: true, message: "missing body"});
      }
      const singleClass = await classesCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!singleClass) {
        return res.status(404).send({error: true, message: "Class not found"});
      }

      // update status conditionally
      let updateDoc;
      if (status === "denied") {
        if (!feedback) {
          return res.status(400).send({error: true, message: "missing body"});
        }
        updateDoc = {
          $set: {
            status: status,
            feedback: feedback,
          },
        };
      } else {
        updateDoc = {
          $set: {
            status: status,
          },
        };
      }
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

    // popular instructor
    app.get("/popular-instructors", async (req, res) => {
      // popular classes
      const popularClasses = await classesCollection
        .find({status: "approved"})
        .toArray();
      popularClasses.sort((a, b) => b.enrolled - a.enrolled);

      // find all instructors
      const popularInstructors = await usersCollection
        .find({
          _id: {
            $in: popularClasses.map((cls) => new ObjectId(cls.instructorId)),
          },
          userType: "instructor",
        })
        .toArray();
      // if popular instructor not found return error
      if (!popularInstructors.length) {
        return res
          .status(404)
          .send({error: true, message: "popular instructor not found"});
      }

      res.send(popularInstructors);
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

    // get update classes using id
    app.get("/update-class/:id", async (req, res) => {
      const id = req.params.id;
      if (!id) {
        return res.status(400).send({error: true, message: "missing id"});
      }
      // find a class
      const query = {_id: new ObjectId(id)};
      const classData = await classesCollection.findOne(query);

      res.send(classData);
    });

    // edit update classes using id
    app.patch("/update-class/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;

      if (!id || !updatedData) {
        return res.status(400).send({error: true, message: "missing data"});
      }
      const query = {_id: new ObjectId(id)};

      // When update a picture post will be pending
      let updateDoc;
      if (updatedData?.imageURL && typeof updatedData?.imageURL !== "object") {
        updateDoc = {
          $set: {
            className: updatedData.className,
            availableSeats: updatedData.availableSeats,
            price: updatedData.price,
            imageURL: updatedData.imageURL,
            status: "pending",
          },
        };
      } else {
        updateDoc = {
          $set: {
            className: updatedData.className,
            availableSeats: updatedData.availableSeats,
            price: updatedData.price,
          },
        };
      }

      const updatedClass = await classesCollection.updateOne(query, updateDoc);
      res.send(updatedClass);
    });

    // get classes using instructor id
    app.get("/instructor-classes/:instructorId", async (req, res) => {
      const instructorId = req.params.instructorId;
      if (!instructorId) {
        return res
          .status(400)
          .send({error: true, message: "missing instructorId"});
      }
      const query = {instructorId: instructorId};
      const classes = await classesCollection.find(query).toArray();
      res.send(classes);
    });

    // popular classes
    app.get("/popular-classes", async (req, res) => {
      const query = {status: "approved"};
      const classes = await classesCollection.find(query).toArray();

      // sort by enrolled student max to min show data
      classes.sort((a, b) => b.enrolled - a.enrolled);
      res.send(classes);
    });

    // get carts using email
    app.get("/carts/:email", async (req, res) => {
      const email = req.params.email;
      if (!email) {
        return res.status(400).send({error: true, message: "missing email"});
      }
      const query = {email: email};
      const carts = await cartsCollection.find(query).toArray();
      res.send(carts);
    });

    // post carts in cart collection
    app.post("/carts", async (req, res) => {
      const cartData = req.body;
      if (!cartData?.email) {
        return res.status(400).send({error: true, message: "missing email"});
      }
      const result = await cartsCollection.insertOne(cartData);
      res.send(result);
    });

    // delete a cart from carts collection using id
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      if (!id) {
        return res.status(400).send({error: true, message: "missing id"});
      }
      const result = await cartsCollection.deleteOne({_id: new ObjectId(id)});
      res.send(result);
    });

    // get enrollments data
    app.get("/enrolled-classes", async (req, res) => {
      const studentId = req.query.studentId;
      if (!studentId) {
        return res
          .status(400)
          .send({error: true, message: "missing studentId"});
      }
      const query = {studentId: studentId};

      const enrollments = await enrollmentCollection.findOne(query);
      // if enrollments is not found return error
      if (!enrollments) {
        return res.send([]); // not set error because it's how warning when fetch data
      }
      const enrolledClassesId = enrollments?.classId;
      const queryForClasses = {
        _id: {$in: enrolledClassesId.map((id) => new ObjectId(id))},
      };

      const enrolledClasses = await classesCollection
        .find(queryForClasses)
        .toArray();

      // if enrolledClasses not available return error
      if (!enrolledClasses) {
        return res
          .status(404)
          .send({error: true, message: "enrolledClasses not found"});
      }
      res.send(enrolledClasses);
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

    // payment related api
    // payment history
    // get payment history using student id
    app.get("/payment-history/:id", async (req, res) => {
      const studentId = req.params.id;
      if (!studentId) {
        return res
          .status(400)
          .send({error: true, message: "missing studentId"});
      }
      const query = {studentId: studentId};
      const payments = await paymentCollection
        .find(query)
        .sort({paymentDate: -1})
        .toArray();
      res.send(payments);
    });

    // payment post a payment
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      // insert data in paymentCollection
      const insertResult = await paymentCollection.insertOne(payment);

      // delete data from cartsCollection
      const deleteQuery = {
        _id: {$in: payment?.cartId.map((id) => new ObjectId(id))},
      };
      const deleteResult = await cartsCollection.deleteMany(deleteQuery);

      // when paymentCollection successfully than update class availableSeats, enrolled
      const classIds = payment?.classId;

      const updateDoc = {
        $inc: {
          availableSeats: -1,
          enrolled: +1,
        },
      };

      const updateClassesResult = await classesCollection.updateMany(
        {_id: {$in: classIds.map((id) => new ObjectId(id))}},
        updateDoc
      );

      // payment successfully add data in enrollmentCollection
      const studentId = payment?.studentId;
      const enrollmentsData = await enrollmentCollection.findOne({
        studentId,
      });

      let enrolledOrUpdatedResult;
      if (enrollmentsData) {
        const updatedClassId = [
          ...new Set([...enrollmentsData?.classId, ...payment?.classId]),
        ];
        const updateDoc = {
          $set: {
            classId: updatedClassId,
          },
        };
        const filter = {studentId};

        enrolledOrUpdatedResult = await enrollmentCollection.updateOne(
          filter,
          updateDoc
        );
      } else {
        const enrolledData = {studentId, classId: payment?.classId};
        enrolledOrUpdatedResult = await enrollmentCollection.insertOne(
          enrolledData
        );
      }

      res.send({
        insertResult,
        deleteResult,
        updateClassesResult,
        enrolledOrUpdatedResult,
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
