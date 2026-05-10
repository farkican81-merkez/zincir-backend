require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Iyzipay = require("iyzipay");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

const iyzipay = new Iyzipay({
  apiKey: process.env.IYZICO_API_KEY,
  secretKey: process.env.IYZICO_SECRET_KEY,
  uri: "https://sandbox-api.iyzipay.com",
  const campaigns = [
  {
    id: "1",
    name: "Mehmet Yilmaz",
    title: "Diz ameliyati faturasi",
    description: "Is kazasi sonucu acil diz ameliyati. Sigorta kapsamiyor.",
    target: 15000,
    raised: 9840,
    donors: 984,
    chainDepth: 6,
    hospital: "Medipol Hastanesi",
    iban: "TR120006200011000062978 18",
    verified: true,
    daysLeft: 4,
  },
  {
    id: "2",
    name: "Ayse Kara",
    title: "Kemoterapi 2. tur",
    description: "Meme kanseri teshisi konuldu. Maddi olarak tukendim.",
    target: 28000,
    raised: 11200,
    donors: 1120,
    chainDepth: 4,
    hospital: "Acibadem Kadikoy",
    iban: "TR330006100519786457841326",
    verified: true,
    daysLeft: 11,
  },
];

const PLATFORM_PCT = 5;
const referrals = {};
const payments = [];

function calcSplit(amount) {
  const platformFee = +(amount * PLATFORM_PCT / 100).toFixed(2);
  const campaignShare = +(amount - platformFee).toFixed(2);
  return { platformFee, campaignShare };
}

function generateRefCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

});app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Zincir Backend is running" });
});

app.get("/api/campaigns", (req, res) => {
  res.json(campaigns);
});

app.get("/api/campaigns/:id", (req, res) => {
  const campaign = campaigns.find((c) => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: "Not found" });
  res.json(campaign);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, function() {
  console.log("Zincir Backend running on port " + PORT);
});

e
