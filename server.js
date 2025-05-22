const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const nodemailer = require("nodemailer");
const { getFirestore } = require("./mockFirebase");
const db = getFirestore();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/debug", async (req, res) => {
  try {
    await db.collection("debug-test").doc("ping").set({ alive: true, date: new Date() });
    res.send("✅ Debug: mock Firebase fonctionne et /debug est joignable");
  } catch (err) {
    res.status(500).send("Erreur /debug: " + err.message);
  }
});

app.post("/api/stripe/create-checkout-session", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [{ price: process.env.PRICE_ID, quantity: 1 }],
      success_url: "https://memo-regen.vercel.app/success",
      cancel_url: "https://memo-regen.vercel.app/cancel",
    });
    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: "Erreur Stripe" });
  }
});

app.get("/api/check-premium/:email", async (req, res) => {
  const email = req.params.email;
  const doc = await db.collection("users").doc(email).get();
  const result = { premium: doc.exists && doc.data().premium };
  res.json(result);
});

app.post("/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
  res.json({ received: true }); // Simulation
});

app.get("/", (req, res) => {
  res.send("✅ MemoRegen backend fonctionne (mock Firebase)");
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Backend MemoRegen en ligne sur le port ${PORT}`);
});
