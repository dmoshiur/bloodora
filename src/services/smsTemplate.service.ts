import { normalizeLang, type Lang } from "../i18n/index.js";

export type SMSTemplate = "otp" | "password_reset" | "security" | "urgent_blood" | "donor" | "order" | "payment" | "admin";

const TEMPLATES: Record<SMSTemplate, Record<Lang, string>> = {
  otp: {
    en: "BloodFerry verification code: {code}. Valid for {minutes} minutes. Never share this code.",
    bn: "BloodFerry যাচাইকরণ কোড: {code}। {minutes} মিনিটের জন্য বৈধ। কাউকে কোডটি দেবেন না।",
    ar: "رمز التحقق من BloodFerry: {code}. صالح لمدة {minutes} دقائق. لا تشارك الرمز مع أي شخص.",
  },
  password_reset: {
    en: "BloodFerry password reset code: {code}. Valid for {minutes} minutes. If you did not request this, secure your account.",
    bn: "BloodFerry পাসওয়ার্ড রিসেট কোড: {code}। {minutes} মিনিটের জন্য বৈধ। আপনি অনুরোধ না করলে অ্যাকাউন্ট সুরক্ষিত করুন।",
    ar: "رمز إعادة تعيين كلمة مرور BloodFerry: {code}. صالح لمدة {minutes} دقائق. إذا لم تطلبه، فأمّن حسابك.",
  },
  security: {
    en: "BloodFerry security alert: {detail}",
    bn: "BloodFerry নিরাপত্তা সতর্কতা: {detail}",
    ar: "تنبيه أمان BloodFerry: {detail}",
  },
  urgent_blood: {
    en: "URGENT BloodFerry: {group} blood needed at {location}. Open BloodFerry if you can help.",
    bn: "জরুরি BloodFerry: {location}-এ {group} রক্ত প্রয়োজন। সাহায্য করতে পারলে BloodFerry খুলুন।",
    ar: "عاجل BloodFerry: مطلوب دم {group} في {location}. افتح BloodFerry إذا كان بإمكانك المساعدة.",
  },
  donor: {
    en: "BloodFerry donor notification: {detail}",
    bn: "BloodFerry রক্তদাতা বিজ্ঞপ্তি: {detail}",
    ar: "إشعار المتبرع BloodFerry: {detail}",
  },
  order: {
    en: "BloodFerry order {id}: {status}. Total ৳{total}.",
    bn: "BloodFerry অর্ডার {id}: {status}। মোট ৳{total}।",
    ar: "طلب BloodFerry {id}: {status}. الإجمالي ৳{total}.",
  },
  payment: {
    en: "BloodFerry payment for order {id} is confirmed. Amount ৳{amount}.",
    bn: "BloodFerry অর্ডার {id}-এর পেমেন্ট নিশ্চিত হয়েছে। পরিমাণ ৳{amount}।",
    ar: "تم تأكيد دفع طلب BloodFerry {id}. المبلغ ৳{amount}.",
  },
  admin: {
    en: "BloodFerry admin alert: {detail}",
    bn: "BloodFerry অ্যাডমিন সতর্কতা: {detail}",
    ar: "تنبيه مسؤول BloodFerry: {detail}",
  },
};

export const smsTemplateService = {
  render(template: SMSTemplate, params: Record<string, string | number> = {}, language?: string | null): string {
    const lang = normalizeLang(language) ?? "en";
    let body = TEMPLATES[template][lang];
    for (const [key, value] of Object.entries(params)) {
      body = body.replaceAll(`{${key}}`, String(value).replace(/[\r\n]/g, " ").trim());
    }
    // Hard bound cost and prevent template mistakes from producing huge messages.
    return body.replace(/\{[a-z_]+\}/g, "").trim().slice(0, 480);
  },
};
