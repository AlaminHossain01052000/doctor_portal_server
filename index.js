const express = require("express");
const app = express();
const cors = require("cors");
const admin = require("firebase-admin");
const { MongoClient } = require('mongodb');
const port = process.env.PORT || 5000;
require("dotenv").config();



const serviceAccount = require("./doctor-portal-cc172-firebase-adminsdk-7wdso-8a8d5d6292.json");
const { messaging } = require("firebase-admin");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
// middelware
app.use(cors());
app.use(express.json());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.li11u.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next) {
    if (req?.headers?.authorization.startsWith("Bearer ")) {
        const token = req.headers.authorization.split(" ")[1];
        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }
    }
    next();
}
async function run() {
    try {
        await client.connect();
        const database = client.db("doctor_portal");
        const appointmentCollection = database.collection("appointments");
        const userCollection = database.collection("users");
        // get all the booked appointment
        // app.get("/appointments", async (req, res) => {
        //     const allAppointments = await appointmentCollection.find({}).toArray();
        //     res.json(allAppointments);
        // })
        app.get("/appointments", verifyToken, async (req, res) => {

            const date = req.query.date;

            const query = { patientEmail: req.query.email, time: date }

            const allAppointments = await appointmentCollection.find(query).toArray();
            res.json(allAppointments);
        })
        // justify that user is admin or not
        app.get("/users/:email", async (req, res) => {
            const query = { email: req.params.email };
            const admin = await userCollection.findOne(query);
            let isAdmin = false;
            if (admin?.role === "admin") {
                isAdmin = true;
            }
            res.json({ admin: isAdmin })

        })

        // post an appointment
        app.post("/appointments", async (req, res) => {

            const bookedAppointment = await appointmentCollection.insertOne(req.body);
            res.json(bookedAppointment);
        })

        // post an user
        app.post("/users", async (req, res) => {
            const user = await userCollection.insertOne(req.body);
            res.json(user);
        })
        app.put("/users", async (req, res) => {
            const user = req.body;
            console.log(user);
            const query = { email: user.email };
            const option = { upsert: true };
            const updateDoc = { $set: user }
            const result = await userCollection.updateOne(query, updateDoc, option);
            res.json(result);
            console.log(result);
        })
        app.put("/users/admin", verifyToken, async (req, res) => {
            console.log(req.decodedEmail);
            const requester = req.decodedEmail;
            if (requester) {
                const adminStatus = await userCollection.findOne({ email: requester });
                if (adminStatus.role === "admin") {
                    const email = req.body.email;
                    const query = { email: email };
                    const updateDoc = { $set: { role: "admin" } }
                    const admin = await userCollection.updateOne(query, updateDoc);
                    res.json(admin);
                }
            }
            else {
                res.status(403).json("You Do Not Have Access to make anyone admin");
            }

        })
    }
    finally {

    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("server is good")
})
app.listen(port, () => {
    console.log("listening to port", port)
})