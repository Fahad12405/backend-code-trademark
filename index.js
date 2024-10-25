import express from "express";
import chalk from "chalk";
import dotenv from "dotenv";
import cors from "cors";
import nodemailer from 'nodemailer'
import bodyParser from "body-parser";
import Stripe from 'stripe'
import { ReasonPhrases, StatusCodes } from "http-status-codes";

// .env configuration
dotenv.config();

// CORS Policy defined
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  credentials: false,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

const domainEmail = process.env.EMAIL_USER || ''
const passwordEmail = process.env.EMAIL_PASS || ''
const secretKey = process.env.STRIPE_SECRET_KEY || ''
const signKey = process.env.STRIPE_SIGN || ''
const port = process.env.PORT || 3000


app.get('/', async (req, res) => {
  res.send(`API is running on this ${port}`)
})




const stripe = Stripe(secretKey);

const transporter = nodemailer.createTransport({
  host: 'mail.trademark-gov.us',
  port: 587,
  secure: false,
  auth: {
    user: domainEmail,
    pass: passwordEmail
  }
});

// Webhook endpoint to listen for Stripe events
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, signKey);
  } catch (err) {
    console.log(`⚠️  Webhook signature verification failed.`, err.message);
    return res.sendStatus(400);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // You can retrieve the user data from your system or from session metadata
    const { markName, ownershipType, firstName, lastName, country, address, city, state, zip, phone, email, description, searchType, plan, processingSpeed, termsAccepted } = session.metadata;

    let dataText = `Mark Name: ${markName}\n` +
      `Ownership Type: ${ownershipType}\n` +
      `First Name: ${firstName}\n` +
      `Last Name: ${lastName}\n` +
      `Country: ${country}\n` +
      `Address: ${address}\n` +
      `City: ${city}\n` +
      `State: ${state}\n` +
      `Zip: ${zip}\n` +
      `Phone: ${phone}\n` +
      `Email: ${email}\n` +
      `Description: ${description}\n` +
      `Search Type: ${searchType}\n` +
      `Package: ${plan}\n` +
      `Processing Speed: ${processingSpeed}\n` +
      `Terms Accepted: ${termsAccepted ? 'Yes' : 'No'}`;

    const mailOptions = {
      from: email,
      to: 'info@trademark-gov.us',
      subject: 'New User Email Submission',
      text: `You received a new email from: ${email}\n\nData:\n${dataText}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log('Error sending email:', error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });
  }

  res.sendStatus(200);
});





// Checkout session creation
app.post('/create-checkout-session', async (req, res) => {
  const { packege } = req.body;
  const { description, name, price } = packege;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: name,
            description: description,
          },
          unit_amount: parseInt(price, 10) * 100,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'https://trademark-gov.us/success.html',
      cancel_url: 'https://trademark-gov.us/cancel.html',
      metadata: { // Pass data through metadata
        markName: packege.markName,
        ownershipType: packege.ownershipType,
        firstName: packege.firstName,
        lastName: packege.lastName,
        country: packege.country,
        address: packege.address,
        city: packege.city,
        state: packege.state,
        zip: packege.zip,
        phone: packege.phone,
        email: packege.email,
        description: packege.description,
        searchType: packege.searchType,
        plan: packege.packege,
        processingSpeed: packege.processingSpeed,
        termsAccepted: packege.termsAccepted,
      }
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).send('Internal Server Error');
  }
});







app.get("*", (req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({ message: ReasonPhrases.NOT_FOUND });
});

// listening port
app.listen(port, () =>
  console.log(chalk.white.bgBlue("Server started on port " + port))
);
