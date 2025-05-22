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
    res.status(500).json({ error: "Erreur Stripe" });
  }
});

// Vérifie si un utilisateur est premium
app.get("/api/check-premium/:email", async (req, res) => {
  const email = req.params.email;
  console.log(`🔍 Vérification premium pour : ${email}`);
  try {
    if (!db) throw new Error("Firestore non initialisé");
    const doc = await db.collection("users").doc(email).get();
    const result = { premium: doc.exists && doc.data().premium };
    console.log("✅ Résultat:", result);
    res.json(result);
  } catch (err) {
    console.error("❌ Erreur dans /check-premium:", err.message);
    res.status(500).send("Erreur serveur : " + err.message);
  }
});

// Webhook Stripe pour activer l'utilisateur premium après paiement
app.post("/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], endpointSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details.email;
    const locale = session.locale || 'fr';

    await db.collection("users").doc(email).set({
      premium: true,
      subscribedAt: new Date(),
      locale: locale
    }, { merge: true });

    const messages = {
      fr: {
        subject: 'Bienvenue sur MemoRegen 🎉',
        html: '<h1>Merci pour votre abonnement !</h1><p>Votre accès premium est actif.</p>'
      },
      en: {
        subject: 'Welcome to MemoRegen 🎉',
        html: '<h1>Thanks for subscribing!</h1><p>Your premium access is active.</p>'
      }
    };

    const selected = messages[locale] || messages.fr;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: `MemoRegen <${process.env.EMAIL_USER}>`,
      to: email,
      subject: selected.subject,
      html: selected.html
    });
  }

  res.json({ received: true });
});

// Route test simple
app.get("/", (req, res) => {
  res.send("✅ MemoRegen backend fonctionne !");
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Backend MemoRegen en ligne sur le port ${PORT}`);
});
