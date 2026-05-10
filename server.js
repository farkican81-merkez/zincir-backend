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
  uri: "https://sandbox-api.iyzipay.com"
});
const campaigns = [
  {
    id: "1",
    name: "Mehmet Yilmaz",
    title: "Diz ameliyati faturasi",
    description: "Is kazasi sonucu acil diz ameliyati.",
    target: 15000,
    raised: 9840,
    donors: 984,
    chainDepth: 6,
    hospital: "Medipol Hastanesi",
    iban: "TR120006200011000062978 18",
    verified: true,
    daysLeft: 4
  },
  {
    id: "2",
    name: "Ayse Kara",
    title: "Kemoterapi 2. tur",
    description: "Meme kanseri teshisi konuldu.",
    target: 28000,
    raised: 11200,
    donors: 1120,
    chainDepth: 4,
    hospital: "Acibadem Kadikoy",
    iban: "TR330006100519786457841326",
    verified: true,
    daysLeft: 11
  }
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
app.get("/", function(req, res) {
  res.json({ status: "ok", message: "Zincir Backend running" });
});
app.get("/api/campaigns", function(req, res) {
  res.json(campaigns);
});
app.get("/api/campaigns/:id", function(req, res) {
  const campaign = campaigns.find(function(c) { return c.id === req.params.id; });
  if (!campaign) return res.status(404).json({ error: "Not found" });
  res.json(campaign);
});
app.post("/api/payment/start", function(req, res) {
  const campaignId = req.body.campaignId;
  const amount = req.body.amount;
  const buyerName = req.body.buyerName;
  const buyerEmail = req.body.buyerEmail;
  const buyerPhone = req.body.buyerPhone;
  const refCode = req.body.refCode;
  if (!campaignId || !amount || !buyerName || !buyerEmail) {
    return res.status(400).json({ error: "Missing fields" });
  }
  const campaign = campaigns.find(function(c) { return c.id === campaignId; });
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });
  const split = calcSplit(amount);
  const conversationId = uuidv4();
  const newRefCode = generateRefCode();
  referrals[newRefCode] = { campaignId: campaignId, parentRef: refCode || null, buyerEmail: buyerEmail, createdAt: new Date() };
  const nameParts = buyerName.split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ") || "User";
  const request = {
    locale: Iyzipay.LOCALE.TR,
    conversationId: conversationId,
    price: amount.toFixed(2),
    paidPrice: amount.toFixed(2),
    currency: Iyzipay.CURRENCY.TRY,
    basketId: "basket-" + campaignId + "-" + conversationId,
    paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
    callbackUrl: process.env.BASE_URL + "/api/payment/callback",
    enabledInstallments: [1],
    buyer: { id: buyerEmail, name: firstName, surname: lastName, email: buyerEmail, identityNumber: "11111111111", registrationAddress: "Turkey", city: "Istanbul", country: "Turkey", gsmNumber: buyerPhone || "+905000000000" },
    shippingAddress: { contactName: buyerName, city: "Istanbul", country: "Turkey", address: "Turkey" },
    billingAddress: { contactName: buyerName, city: "Istanbul", country: "Turkey", address: "Turkey" },
    basketItems: [
      { id: "bagis-" + campaignId, name: campaign.title + " Bagis", category1: "Bagis", itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL, price: split.campaignShare.toFixed(2) },
      { id: "platform-fee", name: "Platform Hizmeti", category1: "Hizmet", itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL, price: split.platformFee.toFixed(2) }
    ]
  };
  iyzipay.checkoutFormInitialize.create(request, function(err, result) {
    if (err) return res.status(500).json({ error: "Payment failed" });
    if (result.status !== "success") return res.status(400).json({ error: result.errorMessage });
    payments.push({ conversationId: conversationId, campaignId: campaignId, amount: amount, platformFee: split.platformFee, campaignShare: split.campaignShare, refCode: newRefCode, parentRef: refCode || null, buyerEmail: buyerEmail, status: "pending", createdAt: new Date() });
    res.json({ checkoutFormContent: result.checkoutFormContent, token: result.token, conversationId: conversationId, refCode: newRefCode, split: split });
  });
});
app.post("/api/payment/callback", function(req, res) {
  const token = req.body.token;
  iyzipay.checkoutForm.retrieve({ locale: Iyzipay.LOCALE.TR, token: token }, function(err, result) {
    if (err || result.status !== "success") return res.redirect(process.env.FRONTEND_URL + "?payment=fail");
    const payment = payments.find(function(p) { return p.conversationId === result.conversationId; });
    if (payment) {
      payment.status = "success";
      const campaign = campaigns.find(function(c) { return c.id === payment.campaignId; });
      if (campaign) {
        campaign.raised = Math.min(campaign.raised + payment.campaignShare, campaign.target);
        campaign.donors += 1;
        campaign.chainDepth += 1;
        if (campaign.raised >= campaign.target) { campaign.completed = true; }
      }
    }
    res.redirect(process.env.FRONTEND_URL + "?payment=success&ref=" + (payment ? payment.refCode : ""));
  });
});
app.get("/api/stats", function(req, res) {
  const totalRaised = campaigns.reduce(function(a, c) { return a + c.raised; }, 0);
  const totalDonors = campaigns.reduce(function(a, c) { return a + c.donors; }, 0);
  const platformEarned = payments.filter(function(p) { return p.status === "success"; }).reduce(function(a, p) { return a + p.platformFee; }, 0);
  res.json({ totalRaised: totalRaised, totalDonors: totalDonors, platformEarned: platformEarned, totalCampaigns: campaigns.length });
});
app.get("/api/referral/:code", function(req, res) {
  const ref = referrals[req.params.code];
  if (!ref) return res.status(404).json({ error: "Not found" });
  res.json(ref);
});
const PORT = process.env.PORT || 3001;
app.listen(PORT, function() {
  console.log("Zincir Backend running on port " + PORT);
});
