const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const User = require("../models/UserModel");
const SubscriptionHistory = require("../models/SubscriptionHistoryModel");
const Subscription = require("../models/SubscriptionPlansModel");
// const nodemailer = require("nodemailer");
// const PDFDocument = require("pdfkit"); // ✅ ADD THIS

const clientUrl = process.env.PAYMENT_URL;
let isMonthlyPlan;

// ✅ Initialize transporter WITH verification
// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.SUPPORT_EMAIL,
//     pass: process.env.SUPPORT_PASSWORD,
//   },
// });

// Verify transporter on startup
// transporter.verify(function (error, success) {
//   if (error) {
//     console.error("❌ SMTP Connection Error:", error);
//   } else {
// console.log("✅ SMTP Server is ready to send emails");
//   }
// });

// ✅ Helper function for money formatting
// function money(amount, currency = "USD") {
//   try {
//     return new Intl.NumberFormat("en-US", {
//       style: "currency",
//       currency,
//     }).format(amount);
//   } catch {
//     return `${amount} ${currency}`;
//   }
// }
// function drawLine(doc, y) {
//   doc.strokeColor("#E5E7EB").lineWidth(1).moveTo(50, y).lineTo(545, y).stroke();
// }

// ✅ PDF Generation function (moved here since it's only used here)
// function generateInvoicePdfBuffer({
//   invoiceNo,
//   invoiceDate,
//   customerName,
//   customerEmail,
//   planName,
//   amount,
//   currency,
//   paymentId,
//   company = {
//     brand: "Global Scrap Exchange",
//     legalName: "Scrap Don",
//     address1: "Address",
//     address2: "City, Country",
//     email: "support@scrapexchange.com",
//     website: "www.scrapexchange.com",
//   },
// }) {
//   return new Promise((resolve, reject) => {
//    try {
//      const doc = new PDFDocument({ size: "A4", margin: 50 });
//      const chunks = [];

//      doc.on("data", (c) => chunks.push(c));
//      doc.on("end", () => resolve(Buffer.concat(chunks)));

//      // ===== Header (Company left, Invoice right) =====
//      doc
//        .font("Helvetica-Bold")
//        .fontSize(22)
//        .fillColor("#111827")
//        .text(company.brand || "Company", 50, 50);

//      doc
//        .font("Helvetica")
//        .fontSize(10)
//        .fillColor("#374151")
//        .text(company.legalName || "", 50, 78)
//        .text(company.address1 || "", 50, 92)
//        .text(company.address2 || "", 50, 106)
//        .text(company.email || "", 50, 120)
//        .text(company.website || "", 50, 134);

//      // ===== Right Header (no overlap) =====
//      const rightX = 350; // starting x of right block
//      const rightW = 195; // width (A4 page minus margins approx)
//      let yRight = 50;

//      doc
//        .font("Helvetica-Bold")
//        .fontSize(18)
//        .fillColor("#111827")
//        .text("INVOICE", rightX, yRight, { width: rightW, align: "right" });

//      yRight = doc.y + 6;

//      doc
//        .font("Helvetica")
//        .fontSize(10)
//        .fillColor("#374151")
//        .text(`Invoice No: ${invoiceNo}`, rightX, yRight, {
//          width: rightW,
//          align: "right",
//        });

//      doc.text(`Date: ${invoiceDate}`, rightX, doc.y + 2, {
//        width: rightW,
//        align: "right",
//      });

//      doc.text(`Payment Ref: ${paymentId || "-"}`, rightX, doc.y + 2, {
//        width: rightW,
//        align: "right",
//      });

//      drawLine(doc, 160);

//      // ===== Bill To =====
//      doc
//        .font("Helvetica-Bold")
//        .fontSize(12)
//        .fillColor("#111827")
//        .text("Bill To", 50, 175);

//      doc
//        .font("Helvetica")
//        .fontSize(10)
//        .fillColor("#374151")
//        .text(customerName || "Customer", 50, 195)
//        .text(customerEmail || "-", 50, 210);

//      // ===== Table Header =====
//      const tableTop = 245;
//      drawLine(doc, tableTop - 10);

//      doc
//        .font("Helvetica-Bold")
//        .fontSize(10)
//        .fillColor("#111827")
//        .text("Description", 50, tableTop)
//        .text("Qty", 350, tableTop, { width: 40, align: "right" })
//        .text("Unit Price", 410, tableTop, { width: 70, align: "right" })
//        .text("Amount", 495, tableTop, { width: 50, align: "right" });

//      drawLine(doc, tableTop + 18);

//      // ===== Table Row =====
//      const rowY = tableTop + 30;
//      const qty = 1;
//      const unitPrice = amount;

//      doc
//        .font("Helvetica")
//        .fontSize(10)
//        .fillColor("#374151")
//        .text(`${planName} (Monthly subscription)`, 50, rowY, { width: 280 })
//        .text(String(qty), 350, rowY, { width: 40, align: "right" })
//        .text(money(unitPrice, currency), 410, rowY, {
//          width: 70,
//          align: "right",
//        })
//        .text(money(amount, currency), 495, rowY, { width: 50, align: "right" });

//      drawLine(doc, rowY + 25);

//      // ===== Totals =====
//      const total = amount;

//      const totalsTop = rowY + 45;

//      doc.font("Helvetica").fontSize(10).fillColor("#374151");

//      // Subtotal
//      doc.text("Subtotal", 400, totalsTop, { width: 90, align: "right" });
//      doc.text(money(amount, currency), 495, totalsTop, {
//        width: 50,
//        align: "right",
//      });

//      // Line
//      drawLine(doc, totalsTop + 18);

//      // Total (Bold)
//      doc
//        .font("Helvetica-Bold")
//        .fontSize(12)
//        .fillColor("#111827")
//        .text("Total", 400, totalsTop + 28, {
//          width: 90,
//          align: "right",
//        });

//      doc
//        .font("Helvetica-Bold")
//        .fontSize(12)
//        .fillColor("#111827")
//        .text(money(total, currency), 495, totalsTop + 28, {
//          width: 50,
//          align: "right",
//        });

//      // if (taxRate > 0) {
//      //   doc.text(`${taxLabel} (${Math.round(taxRate * 100)}%)`, 400, totalsTop + 16, {
//      //     width: 90,
//      //     align: "right",
//      //   });
//      //   doc.text(money(taxAmount, currency), 495, totalsTop + 16, {
//      //     width: 50,
//      //     align: "right",
//      //   });
//      // }

//      // drawLine(doc, totalsTop + (taxRate > 0 ? 40 : 24));

//      // doc
//      //   .font("Helvetica-Bold")
//      //   .fontSize(12)
//      //   .fillColor("#111827")
//      //   .text("Total", 400, totalsTop + (taxRate > 0 ? 48 : 32), {
//      //     width: 90,
//      //     align: "right",
//      //   });

//      // doc
//      //   .font("Helvetica-Bold")
//      //   .fontSize(12)
//      //   .fillColor("#111827")
//      //   .text(money(total, currency), 495, totalsTop + (taxRate > 0 ? 48 : 32), {
//      //     width: 50,
//      //     align: "right",
//      //   });

//      // ===== Footer Note =====
//      doc
//        .font("Helvetica")
//        .fontSize(9)
//        .fillColor("#6B7280")
//        .text(
//          "This invoice was generated electronically and is valid without a signature.",
//          50,
//          740,
//          { align: "left" },
//        );

//      doc.end();
//    } catch (e) {
//       reject(e);
//     }
//   });
// }

// ✅ Create checkout session
const createCheckoutSession = async (req, res) => {
  try {
    const { planId, name, price, userId, isMonthly } = req.body;

    if (!planId || !userId) {
      return res.status(400).json({ message: "planId and userId required" });
    }

    isMonthlyPlan = isMonthly;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "sepa_debit", "ideal", "klarna"],
      line_items: [
        {
          price_data: {
            currency: "thb",
            product_data: { name: name || "Subscription Plan" },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${clientUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}&user_id=${userId}&plan_id=${planId}`,
      cancel_url: `${clientUrl}/payment-cancel`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe Checkout Error:", err);
    res
      .status(500)
      .json({ message: "Stripe checkout failed", error: err.message });
  }
};

// ✅ Verify session & update user plan
const verifyAndSavePlan = async (req, res) => {
  try {
    let { session_id, user_id, plan_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ message: "session_id is required" });
    }

    console.log("✅ verifyAndSavePlan HIT", req.body);
    console.log("📧 Email Config Check:");
    console.log("- SUPPORT_EMAIL exists:", !!process.env.SUPPORT_EMAIL);
    console.log("- SUPPORT_PASSWORD exists:", !!process.env.SUPPORT_PASSWORD);

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      return res.status(400).json({ message: "Payment not completed" });
    }

    // Fallback to session metadata
    if (!user_id) user_id = session.metadata?.userId;
    if (!plan_id) plan_id = session.metadata?.planId;

    if (!user_id || !plan_id) {
      return res.status(400).json({
        message:
          "Missing user_id/plan_id (not in body and not in session metadata)",
      });
    }

    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const plan = await Subscription.findById(plan_id);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    // const planUserType = plan.userType?.[0];
    // if (!planUserType) {
    //   return res.status(400).json({ message: "Invalid plan configuration" });
    // }

    const startDate = new Date();
    const endDate = new Date(startDate);

    if (isMonthlyPlan) {
      endDate.setDate(endDate.getDate() + 30);
    } else {
      endDate.setDate(endDate.getDate() + 365);
    }

    // Update user subscriptions
    // await User.updateOne(
    //   { _id: user._id },
    //   { $pull: { subscriptions: { userType: planUserType } } },
    // );

    await User.updateOne(
      { _id: user._id },
      {
        $push: {
          subscriptions: {
            subscriptionId: plan_id,
            // userType: planUserType,
            startDate,
            endDate,
            status: "active",
            stripeSessionId: session_id,
          },
        },
      },
    );

    user.subscriptionId = plan_id;
    user.subscriptionStartDate = startDate;
    user.subscriptionEndDate = endDate;
    user.subscriptionStatus = "active";
    await user.save({ validateModifiedOnly: true });

    await SubscriptionHistory.create({
      userId: user_id,
      // userType: planUserType,
      planId: plan_id,
      stripeSessionId: session_id,
      amount: (session.amount_total || 0) / 100,
      currency: session.currency || "THB",
      status: "active",
      startDate,
      endDate,
    });

    // ✅ INVOICE + EMAIL
    // const amount = (session.amount_total || 0) / 100;
    // const currency = (session.currency || "thb").toUpperCase(); // ✅ FIXED: "dol" → "eur"
    // const invoiceNo = `INV-${new Date().getFullYear()}-${Date.now()}`;
    // const invoiceDate = new Date().toISOString().slice(0, 10);

    // console.log("📄 Generating invoice", invoiceNo);

    // Email sending function
    // const sendInvoice = async () => {
    //   try {
    //     console.log("✉️ Preparing to send email to:", user.email);

    //     // Generate PDF
    //     const pdfBuffer = await generateInvoicePdfBuffer({
    //       invoiceNo,
    //       invoiceDate,
    //       customerName: user.name,
    //       customerEmail: user.email,
    //       planName: plan.name || "Subscription Plan",
    //       amount,
    //       currency,
    //       paymentId: session.payment_intent || session_id,
    //     });

    //     console.log("✅ PDF generated successfully");

    //     // Prepare email
    //     const subject = `Your Invoice ${invoiceNo}`;
    //     const html = `
    //       <div style="font-family: Arial, sans-serif; line-height:1.6">
    //         <p>Hi ${user.name || "there"},</p>
    //         <p>Thank you for your payment.</p>
    //         <p>Your invoice <b>${invoiceNo}</b> is attached with this email.</p>
    //         <p>If you have any questions, reply to this email.</p>
    //         <br/>
    //         <p>Regards,<br/>Support Team</p>
    //       </div>
    //     `;

    //     console.log("📤 Sending email via SMTP...");

    //     // Send email
    //     const info = await transporter.sendMail({
    //       from: `"Support" <${process.env.SUPPORT_EMAIL}>`,
    //       to: user.email,
    //       subject,
    //       html,
    //       attachments: [
    //         {
    //           filename: `${invoiceNo}.pdf`,
    //           content: pdfBuffer,
    //           contentType: "application/pdf",
    //         },
    //       ],
    //     });

    //     console.log(`✅ Invoice email sent successfully to ${user.email}`);
    //     console.log(`📧 Message ID: ${info.messageId}`);
    //     return true;
    //   } catch (err) {
    //     console.error("❌ Invoice email failed:");
    //     console.error("Error Code:", err.code);
    //     console.error("Error Message:", err.message);
    //     console.error("Full Error:", err);
    //     return false;
    //   }
    // };

    // Send the email
    // const emailSent = await sendInvoice();

    return res.status(200).json({
      success: true,
      message: "Plan saved successfully",
      subscriptionId: plan_id,
      subscriptionStartDate: startDate,
      subscriptionEndDate: endDate,
      subscriptionStatus: "active",
      // invoiceNo,
      // emailSent,
    });
  } catch (err) {
    console.error("Verify Plan Error:", err);
    return res.status(500).json({
      message: "Failed to verify and save plan",
      error: err.message,
    });
  }
};

module.exports = { createCheckoutSession, verifyAndSavePlan };
