const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const nodemailer = require("nodemailer");
const { initializeApp, credential } = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

let db;
try {
  console.log("🔍 Initialisation Firebase...");
  const firebaseCredentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  initializeApp({ credential: credential.cert(firebaseCredentials) });
  db = getFirestore();
  console.log("✅ Connexion Firebase réussie.");
} catch (error) {
  console.error("❌ Échec Firebase:", error.message);
}

const app = express();
app.use(cors());
app.use(express.json());

// Route test de debug
app.get("/debug", async (req, res) => {
  try {
    const testDoc = db ? await db.collection("debug-test").doc("ping").set({ alive: true, date: new Date() }) : null;
    res.send("✅ Debug: Firebase fonctionne et /debug est joignable");
  } catch (err) {
    console.error("❌ Erreur /debug:", err.message);
    res.status(500).send("Erreur /debug: " + err.message);
  }
});

// Crée une session Stripe Checkout
app.post("/api/stripe/create-checkout-session", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        { price: process.env.PRICE_ID, quantity: 1 }
      ],
      success_url: "https://memo-regen.vercel.app/success",
      cancel_url: "https://memo-regen.vercel.app/cancel"
    });
    res.json({ url: session.url });
  } catch (error) {
    console.error("❌ Erreur Stripe:", error.message);
    res.statu
