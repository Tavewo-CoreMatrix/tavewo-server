import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    companyName: { type: String, trim: true, maxlength: 160 },
    workEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    phoneNumber: { type: String, trim: true, maxlength: 40 },
    projectType: { type: String, trim: true, maxlength: 120 },
    message: { type: String, trim: true, maxlength: 4000, default: "" },

    // Where the enquiry came from: "contact" (Contact Us page) or
    // "corematrix-landing" (the CoreMatrix ad landing page).
    source: { type: String, trim: true, default: "contact", index: true },
    consent: { type: Boolean, default: false },

    // Ad tracking, so the team can see which campaign each lead came from.
    utm: {
      source: { type: String, trim: true, maxlength: 120 },
      medium: { type: String, trim: true, maxlength: 120 },
      campaign: { type: String, trim: true, maxlength: 160 },
      content: { type: String, trim: true, maxlength: 160 },
      term: { type: String, trim: true, maxlength: 160 },
    },
    clickId: { type: String, trim: true, maxlength: 300 }, // fbclid or gclid
    pageUrl: { type: String, trim: true, maxlength: 500 },

    status: { type: String, enum: ["new", "contacted", "closed"], default: "new" },
    contactedAt: { type: Date },
    notes: { type: String, trim: true, maxlength: 2000, default: "" },

    // Whether the email to businessops@tavewo.com went out.
    notifiedAt: { type: Date },
    notifyError: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("ContactSubmission", contactSchema);
