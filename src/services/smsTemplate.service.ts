import { normalizeLang, type Lang } from "../i18n/index.js";

export type SMSTemplate = "otp" | "password_reset" | "security" | "urgent_blood" | "donor" | "order" | "payment" | "admin";

const TEMPLATES: Record<SMSTemplate, Record<Lang, string>> = {
  otp: {
    en: "BloodOra verification code: {code}. Valid for {minutes} minutes. Never share this code.",
    bn: "BloodOra যাচাইকরণ কোড: {code}। {minutes} মিনিটের জন্য বৈধ। কাউকে কোডটি দেবেন না।",
    ar: "رمز التحقق من BloodOra: {code}. صالح لمدة {minutes} دقائق. لا تشارك الرمز مع أي شخص.",
  },
  password_reset: {
    en: "BloodOra password reset code: {code}. Valid for {minutes} minutes. If you did not request this, secure your account.",
    bn: "BloodOra পাসওয়ার্ড রিসেট কোড: {code}। {minutes} মিনিটের জন্য বৈধ। আপনি অনুরোধ না করলে অ্যাকাউন্ট সুরক্ষিত করুন।",
    ar: "رمز إعادة تعيين كلمة مرور BloodOra: {code}. صالح لمدة {minutes} دقائق. إذا لم تطلبه، فأمّن حسابك.",
  },
  security: {
    en: "BloodOra security alert: {detail}",
    bn: "BloodOra নিরাপত্তা সতর্কতা: {detail}",
    ar: "تنبيه أمان BloodOra: {detail}",
  },
  urgent_blood: {
    en: "URGENT BloodOra: {group} blood needed at {location}. Open BloodOra if you can help.",
    bn: "জরুরি BloodOra: {location}-এ {group} রক্ত প্রয়োজন। সাহায্য করতে পারলে BloodOra খুলুন।",
    ar: "عاجل BloodOra: مطلوب دم {group} في {location}. افتح BloodOra إذا كان بإمكانك المساعدة.",
  },
  donor: {
    en: "BloodOra donor notification: {detail}",
    bn: "BloodOra রক্তদাতা বিজ্ঞপ্তি: {detail}",
    ar: "إشعار المتبرع BloodOra: {detail}",
  },
  order: {
    en: "BloodOra order {id}: {status}. Total ৳{total}.",
    bn: "BloodOra অর্ডার {id}: {status}। মোট ৳{total}।",
    ar: "طلب BloodOra {id}: {status}. الإجمالي ৳{total}.",
  },
  payment: {
    en: "BloodOra payment for order {id} is confirmed. Amount ৳{amount}.",
    bn: "BloodOra অর্ডার {id}-এর পেমেন্ট নিশ্চিত হয়েছে। পরিমাণ ৳{amount}।",
    ar: "تم تأكيد دفع طلب BloodOra {id}. المبلغ ৳{amount}.",
  },
  admin: {
    en: "BloodOra admin alert: {detail}",
    bn: "BloodOra অ্যাডমিন সতর্কতা: {detail}",
    ar: "تنبيه مسؤول BloodOra: {detail}",
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
