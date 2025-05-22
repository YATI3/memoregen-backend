const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const nodemailer = require("nodemailer");
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const app = express();
app.use(cors());
app.use(express.json());

// Configuration spéciale uniquement pour la route webhook
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

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

// Vérifie si un utilisateur est premium
app.get("/api/check-premium/:email", async (req, res) => {
  const email = req.params.email;
  try {
    const doc = await db.collection("users").doc(email).get();
    res.json({ premium: doc.exists && doc.data().premium });
  } catch (err) {
    res.status(500).send("Erreur serveur");
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
    res.status(500).json({ error: "Erreur Stripe" });
  }
});

// Route test
app.get("/", (req, res) => {
  res.send("✅ MemoRegen backend fonctionne !");
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Backend MemoRegen en ligne sur le port ${PORT}`);
});
