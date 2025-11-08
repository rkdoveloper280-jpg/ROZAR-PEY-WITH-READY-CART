import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import Razorpay from "razorpay";
import dotenv from "dotenv";
import admin from "firebase-admin";

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}
const db = admin.firestore();

// ✅ Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 🧾 Route to create order
app.post("/create-order", async (req, res) => {
  try {
    const { amount, currency = "INR", receipt, userData, cartItems } = req.body;

    const options = {
      amount: Math.round(amount * 100), // amount in paise
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    // Save to Firestore
    await db.collection("orders").doc(order.id).set({
      orderId: order.id,
      amount,
      currency,
      userData,
      cartItems,
      status: "created",
      createdAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (err) {
    console.error("Order creation failed:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Payment verification route (after payment success)
app.post("/verify-payment", async (req, res) => {
  try {
    const { orderId, paymentId, signature } = req.body;

    await db.collection("orders").doc(orderId).update({
      paymentId,
      signature,
      status: "paid",
      paidAt: new Date().toISOString(),
    });

    res.json({ success: true, message: "Payment verified successfully!" });
  } catch (err) {
    console.error("Payment verification error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Default Route
app.get("/", (req, res) => {
  res.send("🔥 Razorpay + Firebase Server is Running!");
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
