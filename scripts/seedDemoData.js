/**
 * Demo data seeder.
 *
 *   node scripts/seedDemoData.js           insert demo data (refuses to run twice)
 *   node scripts/seedDemoData.js --reset   delete everything a previous run inserted
 *   node scripts/seedDemoData.js --follow  give accounts created after seeding some followed hosts
 *
 * Catalog collections (gifts, plans, impressions, ...) are only filled when they are empty.
 * Every inserted _id is recorded in the "seed_meta" collection so --reset removes only seeded docs.
 * Seeded accounts have no Firebase account behind them, so nobody can log in as them.
 */
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const { validateEnv } = require("../config/env");
validateEnv();

const mongoose = require("mongoose");
const moment = require("moment-timezone");
const Cryptr = require("cryptr");
const cryptr = new Cryptr("myTotallySecretKey");

const Agency = require("../models/agency.model");
const Block = require("../models/block.model");
const Chat = require("../models/chat.model");
const ChatTopic = require("../models/chatTopic.model");
const CheckIn = require("../models/checkIn.model");
const CoinPlan = require("../models/coinPlan.model");
const Currency = require("../models/currency.model");
const DailyReward = require("../models/dailyRewardCoin.model");
const FollowerFollowing = require("../models/followerFollowing.model");
const Gift = require("../models/gift.model");
const GiftCategory = require("../models/giftCategory.model");
const History = require("../models/history.model");
const Host = require("../models/host.model");
const IdentityProof = require("../models/identityProof.model");
const Impression = require("../models/impression.model");
const LiveBroadcastHistory = require("../models/liveBroadcastHistory.model");
const Message = require("../models/message.model");
const Notification = require("../models/notification.model");
const PaymentMethod = require("../models/paymentMethod.model");
const Report = require("../models/report.model");
const ReportReason = require("../models/reportReason.model");
const Setting = require("../models/setting.model");
const User = require("../models/user.model");
const VipPlan = require("../models/vipPlan.model");
const VipPlanPrivilege = require("../models/vipPlanPrivilege.model");
const WithdrawalRequest = require("../models/withdrawalRequest.model");

const ROOT = path.join(__dirname, "..");
const SEED_DIR = path.join(ROOT, "storage", "seed");
const WEB_DIR = process.env.SEED_WEB_DIR || path.join(ROOT, "..", "batting_web");
const META_ID = "demo-seed";
const TZ = "Asia/Kolkata";
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();

//---------------------------------------------------------------- helpers
const oid = () => new mongoose.Types.ObjectId();
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const chance = (p) => Math.random() < p;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const sample = (arr, n) => shuffle(arr).slice(0, Math.min(n, arr.length));
const round2 = (n) => Number(n.toFixed(2));
const dateStr = (d) => new Date(d).toLocaleString("en-US", { timeZone: TZ });
const between = (from, to) => new Date(from + Math.random() * Math.max(to - from, 1));
const daysAgo = (min, max) => new Date(NOW - (min + Math.random() * (max - min)) * DAY);
const flag = (code) => `https://flagcdn.com/w320/${code}.png`;
const firebaseLikeUid = () => crypto.randomBytes(21).toString("base64").replace(/[+/=]/g, "x").slice(0, 28);
const slug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .trim()
    .replace(/ +/g, ".");

const meta = {};
const track = (Model, docs) => {
  const key = Model.collection.name;
  meta[key] = (meta[key] || []).concat(docs.map((d) => d._id));
};

async function insert(Model, docs) {
  if (!docs.length) return docs;
  for (const d of docs) {
    if (!d._id) d._id = oid();
    if (!d.createdAt) d.createdAt = new Date();
    if (!d.updatedAt) d.updatedAt = d.createdAt;
  }
  for (let i = 0; i < docs.length; i += 500) {
    await Model.insertMany(docs.slice(i, i + 500), { timestamps: false });
  }
  track(Model, docs);
  console.log(`  + ${String(docs.length).padStart(5)}  ${Model.collection.name}`);
  return docs;
}

//fills a catalog collection only when it is empty; always returns what is in the DB afterwards
async function ensureCatalog(Model, buildDocs) {
  if ((await Model.countDocuments()) > 0) {
    console.log(`  = keep   ${Model.collection.name} (already has data)`);
    return Model.find().lean();
  }
  await insert(Model, await buildDocs());
  return Model.find().lean();
}

async function download(url, fileName, quiet = false, timeoutMs = 20000) {
  const target = path.join(SEED_DIR, fileName);
  if (fs.existsSync(target) && fs.statSync(target).size > 0) return `storage/seed/${fileName}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
    return `storage/seed/${fileName}`;
  } catch (error) {
    if (!quiet) console.warn(`  ! could not download ${url}: ${error.message}`);
    return "";
  }
}

//emoji artwork: Noto 512px (with and without the variation selector), then Twemoji as a fallback
const emoji = async (code, name) =>
  (await download(`https://fonts.gstatic.com/s/e/notoemoji/latest/${code}/512.png`, `${name}.png`, true)) ||
  (await download(`https://fonts.gstatic.com/s/e/notoemoji/latest/${code}_fe0f/512.png`, `${name}.png`, true)) ||
  (await download(`https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/${code}.png`, `${name}.png`));

function loadSharp() {
  for (const candidate of [path.join(WEB_DIR, "node_modules", "sharp"), "sharp"]) {
    try {
      return require(candidate);
    } catch {
      //try next
    }
  }
  return null;
}

//host photos come from the portraits bundled with the web app, resized into storage/seed
async function prepareHostPhotos() {
  const sourceDir = path.join(WEB_DIR, "public", "images", "girls");
  if (!fs.existsSync(sourceDir)) {
    console.warn(`  ! ${sourceDir} not found, hosts will have no photos`);
    return [];
  }
  const sharp = loadSharp();
  if (!sharp) console.warn("  ! sharp not available, copying only photos under 3 MB without resizing");

  const files = fs
    .readdirSync(sourceDir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();
  const photos = [];
  for (let i = 0; i < files.length; i++) {
    const source = path.join(sourceDir, files[i]);
    const fileName = `host_${String(i + 1).padStart(2, "0")}.jpg`;
    const target = path.join(SEED_DIR, fileName);
    try {
      if (!fs.existsSync(target)) {
        if (sharp) {
          await sharp(source).rotate().resize({ width: 900, height: 1200, fit: "cover", position: "attention" }).jpeg({ quality: 80 }).toFile(target);
        } else if (fs.statSync(source).size <= 3 * 1024 * 1024) {
          fs.copyFileSync(source, target);
        } else {
          continue;
        }
      }
      photos.push(`storage/seed/${fileName}`);
    } catch (error) {
      console.warn(`  ! skipped photo ${files[i]}: ${error.message}`);
    }
  }
  return photos;
}

//downloads clips for one video host; returns null when no clip could be fetched
async function prepareVideoHost(clipIds, focusX = 0.5) {
  const sharp = loadSharp();
  const media = { image: "", gallery: [], videos: [] };
  for (const id of clipIds) {
    const base = `https://assets.mixkit.co/videos/${id}/${id}`;
    const video = await download(`${base}-720.mp4`, `video_${id}.mp4`, false, 180000);
    if (!video) continue;
    media.videos.push(video);
    //not every clip has the larger stills
    const still =
      (await download(`${base}-thumb-1080-0.jpg`, `still_${id}.jpg`, true)) ||
      (await download(`${base}-thumb-720-0.jpg`, `still_${id}.jpg`, true)) ||
      (await download(`${base}-thumb-360-0.jpg`, `still_${id}.jpg`));
    if (!still) continue;
    media.gallery.push(still);
    if (!media.image) {
      const fileName = `hostv_${id}.jpg`;
      try {
        if (!sharp) throw new Error("sharp not available");
        if (!fs.existsSync(path.join(SEED_DIR, fileName))) {
          //3:4 portrait window centred on the face
          const source = path.join(SEED_DIR, `still_${id}.jpg`);
          const { width, height } = await sharp(source).metadata();
          const cropWidth = Math.min(width, Math.round(height * 0.75));
          const left = Math.max(0, Math.min(width - cropWidth, Math.round(focusX * width - cropWidth / 2)));
          await sharp(source).extract({ left, top: 0, width: cropWidth, height }).resize(810, 1080).jpeg({ quality: 85 }).toFile(path.join(SEED_DIR, fileName));
        }
        media.image = `storage/seed/${fileName}`;
      } catch {
        media.image = still;
      }
    }
  }
  return media.videos.length ? media : null;
}

//gives real (non-seeded) accounts a few followed hosts so their Following tab is not empty
async function followForRealUsers(seededUserIds, hostIds) {
  const realUsers = await User.find({ _id: { $nin: seededUserIds }, isBlock: false }).select("_id").lean();
  const docs = [];
  for (const user of realUsers) {
    if (await FollowerFollowing.exists({ followerId: user._id })) continue;
    for (const hostId of sample(hostIds, 8)) docs.push({ followerId: user._id, followingId: hostId, createdAt: daysAgo(0, 10) });
  }
  console.log(`Real accounts found: ${realUsers.length}`);
  return insert(FollowerFollowing, docs);
}

//---------------------------------------------------------------- static content
const COUNTRIES = {
  india: { code: "in", dial: "+91", langs: ["Hindi", "English"] },
  philippines: { code: "ph", dial: "+63", langs: ["Filipino", "English"] },
  brazil: { code: "br", dial: "+55", langs: ["Portuguese", "English"] },
  indonesia: { code: "id", dial: "+62", langs: ["Indonesian", "English"] },
  "united states": { code: "us", dial: "+1", langs: ["English"] },
  "united kingdom": { code: "gb", dial: "+44", langs: ["English"] },
  colombia: { code: "co", dial: "+57", langs: ["Spanish", "English"] },
  turkey: { code: "tr", dial: "+90", langs: ["Turkish", "English"] },
  russia: { code: "ru", dial: "+7", langs: ["Russian", "English"] },
  vietnam: { code: "vn", dial: "+84", langs: ["Vietnamese", "English"] },
  thailand: { code: "th", dial: "+66", langs: ["Thai", "English"] },
  ukraine: { code: "ua", dial: "+380", langs: ["Ukrainian", "English"] },
  morocco: { code: "ma", dial: "+212", langs: ["Arabic", "French"] },
  mexico: { code: "mx", dial: "+52", langs: ["Spanish", "English"] },
  germany: { code: "de", dial: "+49", langs: ["German", "English"] },
  italy: { code: "it", dial: "+39", langs: ["Italian", "English"] },
  egypt: { code: "eg", dial: "+20", langs: ["Arabic", "English"] },
  japan: { code: "jp", dial: "+81", langs: ["Japanese", "English"] },
  ireland: { code: "ie", dial: "+353", langs: ["English"] },
};

//demo hosts with video: clips are Mixkit free stock videos (https://mixkit.co/license/), the profile photo is cut from the first clip
//so the same person appears in the photo, the live stream and the video call
//[name, country, clip ids, horizontal position of the face in the first clip's still (0 = left edge, 1 = right edge)]
const VIDEO_HOSTS = [
  ["Camila Souza", "brazil", [2705], 0.48], ["Emily Carter", "united states", [8745], 0.6], ["Valentina Rojas", "colombia", [10444, 10449], 0.55],
  ["Tiana Brooks", "united states", [23797], 0.8], ["Anastasia Volkova", "russia", [28758], 0.52], ["Daria Kovalenko", "ukraine", [29937], 0.38],
  ["Elif Yildiz", "turkey", [33313], 0.55], ["Olivia Hayes", "united kingdom", [33370], 0.42], ["Lena Hoffmann", "germany", [33431], 0.6],
  ["Zeynep Kaya", "turkey", [33532], 0.5], ["Amelia Foster", "united kingdom", [36009], 0.45], ["Daniela Mejia", "colombia", [39798, 39800], 0.45],
  ["Chloe Bennett", "united states", [43828, 43830], 0.52], ["Larissa Costa", "brazil", [48685], 0.5], ["Sofia Marchetti", "italy", [51656], 0.45],
  ["Bianca Oliveira", "brazil", [41202, 41211], 0.66], ["Hannah Schneider", "germany", [47219], 0.42], ["Fernanda Castillo", "mexico", [41181], 0.5],
  ["Salma Bennani", "morocco", [48680], 0.6], ["Ruby Collins", "united kingdom", [1526], 0.42],
];

//photo-only hosts (real host accounts, shown offline because there is nobody to answer a call)
const PHOTO_HOSTS = [
  ["Priya Sharma", "india"], ["Ananya Verma", "india"], ["Sneha Reddy", "india"], ["Angel Santos", "philippines"],
  ["Kavya Nair", "india"], ["Riya Kapoor", "india"], ["Putri Lestari", "indonesia"], ["Aditi Joshi", "india"],
  ["Meera Iyer", "india"], ["Pooja Singh", "india"], ["Bea Cruz", "philippines"], ["Isha Malhotra", "india"],
  ["Tanvi Desai", "india"], ["Linh Nguyen", "vietnam"], ["Nisha Gupta", "india"], ["Simran Kaur", "india"],
  ["Ayu Wulandari", "indonesia"], ["Shruti Bansal", "india"], ["Divya Menon", "india"], ["Jasmine Reyes", "philippines"],
  ["Roshni Kulkarni", "india"], ["Aarohi Mehta", "india"], ["Ploy Suksawat", "thailand"], ["Tanya Arora", "india"],
  ["Sana Qureshi", "india"], ["Ishita Roy", "india"], ["Mahira Sheikh", "india"], ["Kritika Saxena", "india"],
  ["Palak Jain", "india"], ["Zoya Ansari", "india"], ["Mitali Ghosh", "india"], ["Nandini Rao", "india"], ["Rhea Fernandes", "india"],
];

const USER_PEOPLE = [
  ["Rahul Mehta", "india", "male"], ["Arjun Singh", "india", "male"], ["James Walker", "united states", "male"], ["Rohit Verma", "india", "male"],
  ["Karan Malhotra", "india", "male"], ["Lucas Ferreira", "brazil", "male"], ["Vikram Rao", "india", "male"], ["Aman Gupta", "india", "male"],
  ["Michael Torres", "united states", "male"], ["Siddharth Jain", "india", "male"], ["Nikhil Sharma", "india", "male"], ["Ahmed Hassan", "egypt", "male"],
  ["Aditya Kulkarni", "india", "male"], ["Varun Chopra", "india", "male"], ["Daniel Kim", "united states", "male"], ["Manish Yadav", "india", "male"],
  ["Deepak Kumar", "india", "male"], ["Mateo Garcia", "mexico", "male"], ["Saurabh Mishra", "india", "male"], ["Harsh Patel", "india", "male"],
  ["Liam Murphy", "ireland", "male"], ["Yash Agarwal", "india", "male"], ["Abhishek Tiwari", "india", "male"], ["Kenji Tanaka", "japan", "male"],
  ["Rajat Saxena", "india", "male"], ["Kunal Shah", "india", "male"], ["Noah Schmidt", "germany", "male"], ["Mohit Bansal", "india", "male"],
  ["Tarun Bhatia", "india", "male"], ["Carlos Mendoza", "colombia", "male"], ["Imran Sheikh", "india", "male"], ["Faizan Ansari", "india", "male"],
  ["Ryan Cooper", "united kingdom", "male"], ["Sandeep Nair", "india", "male"], ["Pranav Menon", "india", "male"], ["Budi Santoso", "indonesia", "male"],
  ["Gaurav Pandey", "india", "male"], ["Ethan Brown", "united states", "male"], ["Minh Tran", "vietnam", "male"], ["Ali Demir", "turkey", "male"],
  ["Tom Becker", "germany", "male"], ["Jack Wilson", "united kingdom", "male"], ["Omar Farouk", "egypt", "male"], ["Chris Palmer", "united states", "male"],
  ["Ravi Shankar Prasad", "india", "male"], ["Anil Deshmukh", "india", "male"], ["Sameer Qureshi", "india", "male"], ["Vivek Raghavan", "india", "male"],
  ["Jose Ramirez", "philippines", "male"], ["Pedro Almeida", "brazil", "male"],
  ["Neha Bhatt", "india", "female"], ["Shreya Pillai", "india", "female"], ["Jessica Moore", "united states", "female"], ["Maria Lopez", "mexico", "female"],
  ["Anjali Das", "india", "female"], ["Hannah Clarke", "united kingdom", "female"],
];

const HOST_BIOS = [
  "Coffee first, conversations after ☕ Love late night talks and silly jokes.",
  "Dancer at heart 💃 Tell me about your day, I am a good listener.",
  "Foodie, traveller, part-time singer 🎤 Let's talk about anything under the sun.",
  "Small town girl with big dreams ✨ Movies, music and long chats are my thing.",
  "Fitness freak in the morning, Netflix addict at night 🍿",
  "I laugh too loud and talk too much 😄 You have been warned!",
  "Bookworm who loves rainy days and old songs 🌧️📚",
  "New here! Be nice and make me smile 😊",
  "Yoga, chai and good vibes only 🧘‍♀️",
  "Makeup artist by day, your chat buddy by night 💄",
  "I can talk for hours about travel, food and cricket 🏏",
  "Shy at first but the fun one once you know me 🙈",
  "Music is my therapy 🎧 Send me your favourite song.",
  "Living my best life, one video call at a time 🌸",
  "Here to make friends from around the world 🌍",
];

const USER_BIOS = [
  "Just here to make new friends.", "Engineer by profession, traveller by passion.", "Cricket, coffee and good conversations.",
  "Music lover. Gym sometimes.", "Looking for someone fun to talk to after work.", "Foodie exploring one city at a time.",
  "Night owl. Movie buff.", "Simple guy with a big heart.", "", "",
];

//each script alternates u (user) and h (host); a random prefix of it is used
const CONVERSATIONS = [
  [["u", "Hey! How are you doing?"], ["h", "Hii 😊 I am good, just finished dinner. You?"], ["u", "Same here. Your profile is really nice"], ["h", "Aww thank you! Where are you from?"], ["u", "Mumbai. You?"], ["h", "Nice! I have always wanted to visit Mumbai 🌊"], ["u", "You should, I will show you around 😄"], ["h", "Haha deal! Want to hop on a call?"], ["u", "Sure, calling in 2 mins"], ["h", "Okay waiting 💕"]],
  [["u", "Hi, are you free for a call?"], ["h", "Hey! Yes give me 5 minutes"], ["u", "No problem"], ["h", "Ready now, you can call 📞"], ["u", "That was fun, thanks for the chat"], ["h", "I enjoyed it too! Call again tomorrow? 😊"], ["u", "Definitely"]],
  [["u", "Good morning ☀️"], ["h", "Good morning! You are up early"], ["u", "Office day. What about you?"], ["h", "Just lazy in bed with my coffee ☕"], ["u", "Lucky you haha"], ["h", "What do you do for work?"], ["u", "Software developer"], ["h", "Ooh smart guy 🤓 I like that"], ["u", "Haha thanks. Talk in the evening?"], ["h", "Yes please, I will be online after 8"]],
  [["u", "Your smile is beautiful"], ["h", "Thank you so much 🥰 that made my day"], ["u", "What kind of music do you like?"], ["h", "Mostly Bollywood and a bit of pop. You?"], ["u", "Arijit Singh all day"], ["h", "Omg same!! Which song is your favourite?"], ["u", "Channa Mereya"], ["h", "Such a classic 😍 I can sing it for you on call"], ["u", "Now I have to hear that"]],
  [["h", "Hey, thank you for the follow! 💖"], ["u", "Of course, loved your live yesterday"], ["h", "Really? I was so nervous 🙈"], ["u", "You were great. When is the next one?"], ["h", "Tonight around 9. Will you come?"], ["u", "I will be there"], ["h", "Yay! See you then ✨"]],
  [["u", "Hello from Delhi 👋"], ["h", "Hello hello! How is the weather there?"], ["u", "Too hot as always 😅"], ["h", "Haha stay hydrated then"], ["u", "What are you up to this weekend?"], ["h", "Maybe a movie with friends. Any suggestions?"], ["u", "Depends, comedy or thriller?"], ["h", "Thriller! I love a good twist"], ["u", "Then I have a list for you"], ["h", "Send it! 🎬"]],
  [["u", "Hi"], ["h", "Hey there 😊 how was your day?"], ["u", "Long and tiring. Better now"], ["h", "Aw, want to talk about it?"], ["u", "Just work stress. Talking to you helps"], ["h", "I am always here to listen 💕"], ["u", "Thanks, you are sweet"]],
  [["u", "Sent you a little gift 🎁"], ["h", "Omg thank you!! You are too kind 😍"], ["u", "You deserve it"], ["h", "You just made me smile so big"], ["u", "Mission accomplished then 😄"], ["h", "Call me later? I want to say thanks properly"], ["u", "Sure, around 10?"], ["h", "Perfect 💖"]],
  [["u", "Do you like travelling?"], ["h", "I love it! Mountains more than beaches though"], ["u", "Same. Been to Manali?"], ["h", "Not yet, it is on my list 🏔️"], ["u", "You should go in December, the snow is amazing"], ["h", "Take me along 😜"], ["u", "Haha anytime"]],
  [["h", "Missed your call earlier, sorry! 🙈"], ["u", "No worries, are you free now?"], ["h", "Yes, call me"], ["u", "Calling"], ["h", "That was a nice talk, thank you 😊"], ["u", "Same time tomorrow?"], ["h", "I will be waiting"]],
];

const GIFTS = [
  ["Love", "1f339", "rose", 10], ["Love", "2764", "heart", 20], ["Love", "1f48b", "kiss", 30], ["Love", "1f490", "bouquet", 99], ["Love", "1f48d", "ring", 499],
  ["Cute", "1f9f8", "teddy", 50], ["Cute", "1f36d", "lollipop", 5], ["Cute", "1f36b", "chocolate", 15], ["Cute", "1f388", "balloon", 25], ["Cute", "1f984", "unicorn", 199],
  ["Party", "1f382", "cake", 80], ["Party", "1f37e", "champagne", 150], ["Party", "1f381", "giftbox", 60], ["Party", "1f525", "fire", 40], ["Party", "1f31f", "star", 120],
  ["Luxury", "1f451", "crown", 999], ["Luxury", "1f48e", "diamond", 1499], ["Luxury", "1f3ce", "sportscar", 2999], ["Luxury", "1f680", "rocket", 4999], ["Luxury", "1f3f0", "castle", 9999],
];

const AGENCIES = [
  ["Starlight Talent", "india", 1, 12, "Mumbai based talent agency onboarding verified hosts since 2021."],
  ["Bollywood Dreams Media", "india", 1, 10, "Managing 200+ creators across North India."],
  ["Manila Stars Agency", "philippines", 1, 15, "Top rated host agency in Metro Manila."],
  ["Rio Live Entertainment", "brazil", 1, 8, "Brazilian creator network for live streaming apps."],
  ["Crescent Creators", "turkey", 2, 5, "Boutique agency for Turkish and Eastern European hosts."],
  ["Global Hosts Network", "united states", 1, 10, "International agency working with hosts in 12 countries."],
];

//---------------------------------------------------------------- reset
async function reset() {
  const db = mongoose.connection.db;
  const record = await db.collection("seed_meta").findOne({ _id: META_ID });
  if (!record) {
    console.log("Nothing to reset: no previous seed run recorded.");
    return;
  }
  for (const [collection, ids] of Object.entries(record.ids || {})) {
    const { deletedCount } = await db.collection(collection).deleteMany({ _id: { $in: ids } });
    console.log(`  - ${String(deletedCount).padStart(5)}  ${collection}`);
  }
  if (record.demoDataEnabledBySeed?.length) {
    await db.collection("settings").updateMany({ _id: { $in: record.demoDataEnabledBySeed } }, { $set: { isDemoData: false } });
    console.log("Setting isDemoData turned back off. RESTART_BACKEND_REQUIRED");
  }
  await db.collection("seed_meta").deleteOne({ _id: META_ID });
  fs.rmSync(SEED_DIR, { recursive: true, force: true });
  console.log("Seed data removed.");
}

//---------------------------------------------------------------- seed
async function seed() {
  const db = mongoose.connection.db;
  if (await db.collection("seed_meta").findOne({ _id: META_ID })) {
    console.log("Demo data is already seeded. Run with --reset first to seed again.");
    return;
  }
  fs.mkdirSync(SEED_DIR, { recursive: true });

  const setting = (await Setting.findOne().sort({ createdAt: -1 }).lean()) || require("../setting");
  const loginBonus = setting.loginBonus || 5000;
  const adminRate = setting.adminCommissionRate || 10;
  const coinsPerUnit = setting.minCoinsToConvert || 1000;
  const rates = {
    random: setting.generalRandomCallRate || 35,
    randomFemale: setting.femaleRandomCallRate || 25,
    randomMale: setting.maleRandomCallRate || 15,
    video: setting.videoPrivateCallRate || 45,
    audio: setting.audioPrivateCallRate || 35,
    chat: setting.chatInteractionRate || 15,
  };
  const maxFreeChat = setting.maxFreeChatMessages || 0;

  const usedUniqueIds = new Set([...(await User.distinct("uniqueId")), ...(await Host.distinct("uniqueId"))]);
  const uniqueId = () => {
    let id;
    do id = String(rand(10000000, 99999999));
    while (usedUniqueIds.has(id));
    usedUniqueIds.add(id);
    return id;
  };
  const usedHistoryIds = new Set(await History.distinct("uniqueId"));
  const historyId = () => {
    let id;
    do id = `HIS-${crypto.randomUUID().replace(/-/g, "").slice(0, 6)}`;
    while (usedHistoryIds.has(id));
    usedHistoryIds.add(id);
    return id;
  };

  //------------------------------------------------ catalog
  console.log("Catalog:");
  const impressions = await ensureCatalog(Impression, () =>
    ["Friendly", "Funny", "Romantic", "Good Listener", "Talkative", "Cheerful", "Caring", "Bold", "Shy", "Singer", "Dancer", "Foodie", "Traveller", "Gamer"].map((name) => ({ name })),
  );
  const identityProofs = await ensureCatalog(IdentityProof, () => ["Aadhaar Card", "Passport", "Driving Licence", "National ID Card"].map((title) => ({ title })));
  const reportReasons = await ensureCatalog(ReportReason, () =>
    ["Inappropriate behaviour", "Fake profile", "Spam or scam", "Harassment or abuse", "Nudity or sexual content", "Asking for money outside the app"].map((title) => ({ title })),
  );
  const dailyRewards = await ensureCatalog(DailyReward, () => [20, 30, 40, 50, 75, 100, 200].map((dailyRewardCoin, i) => ({ day: i + 1, dailyRewardCoin })));
  await ensureCatalog(Currency, () => [
    { name: "USD", symbol: "$", countryCode: "US", currencyCode: "USD", isDefault: true },
    { name: "INR", symbol: "₹", countryCode: "IN", currencyCode: "INR" },
    { name: "EUR", symbol: "€", countryCode: "EU", currencyCode: "EUR" },
  ]);
  const paymentMethods = await ensureCatalog(PaymentMethod, async () => [
    { name: "UPI", image: await emoji("1f4f1", "pay_upi"), details: ["UPI ID", "Account Holder Name"] },
    { name: "Bank Transfer", image: await emoji("1f3e6", "pay_bank"), details: ["Account Holder Name", "Account Number", "IFSC Code", "Bank Name"] },
    { name: "PayPal", image: await emoji("1f4b3", "pay_paypal"), details: ["PayPal Email"] },
  ]);
  const coinIcon = await emoji("1fa99", "coin");
  const coinPlans = await ensureCatalog(CoinPlan, () =>
    [
      [500, 0, 0.99, false], [1200, 100, 1.99, false], [3200, 400, 4.99, true], [7000, 1000, 9.99, true], [15000, 2500, 19.99, false], [40000, 8000, 49.99, false],
    ].map(([coins, bonusCoins, price, isFeatured]) => ({ coins, bonusCoins, price, isFeatured, iconUrl: coinIcon, productId: `coins_${coins}` })),
  );
  const vipPlans = await ensureCatalog(VipPlan, () => [
    { validity: 1, validityType: "months", coin: 2000, price: 4.99, productId: "vip_1_month" },
    { validity: 3, validityType: "months", coin: 7000, price: 12.99, productId: "vip_3_months" },
    { validity: 1, validityType: "years", coin: 30000, price: 39.99, productId: "vip_1_year" },
  ]);
  await ensureCatalog(VipPlanPrivilege, async () => [
    { vipFrameBadge: await emoji("1f451", "vip_badge"), audioCallDiscount: 10, videoCallDiscount: 10, randomMatchCallDiscount: 15, topUpCoinBonus: 500, freeMessages: 20 },
  ]);
  await ensureCatalog(Message, () => [
    { genderType: 1, message: ["Hey handsome, free to talk? 😊", "Hi! I just came online, say hello 👋", "Bored... want to video call?", "You look interesting, tell me about yourself"] },
    { genderType: 2, message: ["Hi dear, how is your day going?", "Hey! Want to chat for a bit?", "Hello 😊 I am new here, be my friend?"] },
  ]);
  const categories = await ensureCatalog(GiftCategory, () => [...new Set(GIFTS.map((g) => g[0]))].map((name) => ({ name })));
  const gifts = await ensureCatalog(Gift, async () => {
    const docs = [];
    for (const [categoryName, code, name, coin] of GIFTS) {
      const image = await emoji(code, `gift_${name}`);
      const category = categories.find((c) => c.name === categoryName) || categories[0];
      if (image) docs.push({ giftCategoryId: category._id, type: 1, image, coin, filename: `gift_${name}.png` });
    }
    return docs;
  });
  const activeGifts = gifts.filter((g) => !g.isDelete && g.image);
  const activeCoinPlans = coinPlans.filter((p) => p.isActive !== false);
  const activeVipPlans = vipPlans.filter((p) => p.isActive !== false);
  const impressionNames = impressions.map((i) => i.name).filter(Boolean);
  const proofTitles = identityProofs.map((p) => p.title).filter(Boolean);

  //------------------------------------------------ media
  console.log("Media:");
  const hostPhotos = await prepareHostPhotos();
  console.log(`  host photos ready: ${hostPhotos.length}`);
  const malePortraits = shuffle(Array.from({ length: 90 }, (_, i) => i + 1));
  const femalePortraits = shuffle(Array.from({ length: 90 }, (_, i) => i + 1));

  //------------------------------------------------ agencies
  const agencies = [];
  for (const [name, country, commissionType, commission, description] of AGENCIES) {
    const createdAt = daysAgo(80, 120);
    const fileName = `agency_${slug(name).replace(/\./g, "_")}.png`;
    agencies.push({
      _id: oid(),
      uid: firebaseLikeUid(),
      agencyCode: `AG${rand(100000, 999999)}`,
      name,
      commissionType,
      commission,
      email: `contact@${slug(name).replace(/\./g, "")}.example.com`,
      password: cryptr.encrypt("Agency@123"),
      countryCode: Number(COUNTRIES[country].dial.replace("+", "")),
      mobileNumber: rand(7000000000, 9899999999),
      image: await download(`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=256&bold=true&background=random&format=png`, fileName),
      description,
      countryFlagImage: flag(COUNTRIES[country].code),
      country,
      hostCoins: 0,
      totalEarnings: 0,
      totalEarningsWithCommissionAndHostCoin: 0,
      netAvailableEarnings: 0,
      totalWithdrawn: 0,
      totalWithdrawnAmount: 0,
      createdAt,
    });
  }
  const agencyById = new Map(agencies.map((a) => [String(a._id), a]));

  //------------------------------------------------ people
  const users = [];
  const hosts = [];
  const emailFor = (name) => `${slug(name)}${rand(11, 99)}@example.com`;
  const dobFor = (age) => `${new Date().getFullYear() - age}-${String(rand(1, 12)).padStart(2, "0")}-${String(rand(1, 28)).padStart(2, "0")}`;

  const makeUser = ({ name, country, gender, image, createdAt, loginType = 2 }) => {
    const age = rand(21, 42);
    const uid = firebaseLikeUid();
    const user = {
      _id: oid(),
      name,
      selfIntro: "",
      gender,
      dob: dobFor(age),
      bio: pick(USER_BIOS),
      age,
      image,
      email: loginType === 3 ? "" : emailFor(name),
      countryFlagImage: flag(COUNTRIES[country].code),
      country,
      ipAddress: `${rand(49, 223)}.${rand(1, 254)}.${rand(1, 254)}.${rand(1, 254)}`,
      mobileNumber: "",
      countryCode: "",
      loginType,
      identity: uid,
      fcmToken: null,
      uniqueId: uniqueId(),
      firebaseUid: uid,
      provider: loginType === 3 ? "anonymous" : "google.com",
      coin: loginBonus,
      spentCoins: 0,
      rechargedCoins: 0,
      isVip: false,
      isBlock: false,
      isOnline: chance(0.3),
      isBusy: false,
      callId: null,
      isHost: false,
      hostId: null,
      lastlogin: dateStr(daysAgo(0, 6)),
      date: dateStr(createdAt),
      createdAt,
    };
    users.push(user);
    return user;
  };

  //customers
  const customers = [];
  for (let i = 0; i < USER_PEOPLE.length; i++) {
    const [name, country, gender] = USER_PEOPLE[i];
    const createdAt = daysAgo(2, 75);
    const loginType = i % 6 === 5 ? 3 : 2;
    let image = "";
    if (chance(0.8)) {
      const n = gender === "male" ? malePortraits.pop() : femalePortraits.pop();
      image = await download(`https://randomuser.me/api/portraits/${gender === "male" ? "men" : "women"}/${n}.jpg`, `user_${gender}_${n}.jpg`);
    }
    customers.push(makeUser({ name, country, gender, image, createdAt, loginType }));
  }
  customers[7].isBlock = true;

  const makeHost = ({ name, country, createdAt, status = 2, ...overrides }) => {
    const age = rand(20, 31);
    const host = {
      _id: oid(),
      userId: null,
      agencyId: null,
      name,
      gender: "female",
      bio: HOST_BIOS[hosts.length % HOST_BIOS.length],
      age,
      dob: dobFor(age),
      email: emailFor(name),
      countryFlagImage: flag(COUNTRIES[country].code),
      country,
      impression: sample(impressionNames, rand(3, 5)),
      language: COUNTRIES[country].langs,
      identityProofType: "",
      identityProof: [],
      image: "",
      photoGallery: [],
      profileVideo: [],
      video: [],
      liveVideo: [],
      ipAddress: "",
      identity: "",
      fcmToken: null,
      uniqueId: uniqueId(),
      status,
      reason: "",
      randomCallRate: rates.random,
      randomCallFemaleRate: rates.randomFemale,
      randomCallMaleRate: rates.randomMale,
      privateCallRate: rates.video + pick([0, 0, 5, 15, 30]),
      audioCallRate: rates.audio + pick([0, 0, 5, 10]),
      chatRate: rates.chat,
      coin: 0,
      totalGifts: 0,
      redeemedCoins: 0,
      redeemedAmount: 0,
      isBlock: false,
      isFake: false,
      isOnline: false,
      isBusy: false,
      callId: null,
      isLive: false,
      liveHistoryId: null,
      agoraUid: rand(100000, 999999),
      channel: "",
      token: "",
      date: dateStr(createdAt),
      createdAt,
      ...overrides,
    };
    hosts.push(host);
    return host;
  };

  //video hosts use the app's demo-host mode (isFake): they show up in the Live tab and a call plays their clip
  for (const [name, country, clipIds, focusX] of VIDEO_HOSTS) {
    const media = await prepareVideoHost(clipIds, focusX);
    if (!media) continue;
    makeHost({
      name,
      country,
      createdAt: daysAgo(10, 90),
      isFake: true,
      isOnline: true,
      image: media.image,
      photoGallery: [media.image, ...media.gallery],
      profileVideo: media.videos.slice(0, 1),
      video: media.videos,
      liveVideo: media.videos,
    });
  }
  console.log(`  video hosts ready: ${hosts.length}`);

  //photo hosts are real host accounts linked to a user (status: 2 accepted, 1 pending, 3 declined)
  const photoHostCount = Math.min(hostPhotos.length, PHOTO_HOSTS.length);
  for (let i = 0; i < photoHostCount; i++) {
    const [name, country] = PHOTO_HOSTS[i];
    const status = i >= photoHostCount - 4 ? 1 : i === photoHostCount - 5 ? 3 : 2;
    const createdAt = status === 1 ? daysAgo(0, 4) : daysAgo(10, 90);
    const image = hostPhotos[i];
    const user = makeUser({ name, country, gender: "female", image, createdAt: new Date(createdAt.getTime() - rand(1, 5) * DAY) });
    const localAgencies = agencies.filter((a) => a.country === country);
    const agency = chance(0.7) ? pick(localAgencies.length && chance(0.6) ? localAgencies : agencies) : null;
    const host = makeHost({
      name,
      country,
      createdAt,
      status,
      userId: user._id,
      agencyId: agency ? agency._id : null,
      email: user.email,
      identityProofType: pick(proofTitles) || "",
      image,
      photoGallery: [image, ...sample(hostPhotos.filter((p) => p !== image), 3)],
      ipAddress: user.ipAddress,
      identity: user.identity,
      reason: status === 3 ? "Identity proof was not clearly visible. Please re-apply with a clear photo." : "",
    });
    Object.assign(user, { age: host.age, dob: host.dob, bio: host.bio });
    if (status === 2) Object.assign(user, { isHost: true, hostId: host._id });
  }
  const liveHosts = hosts.filter((h) => h.status === 2);

  //------------------------------------------------ activity
  const histories = [];
  const chatTopics = [];
  const chats = [];
  const follows = [];
  const notifications = [];
  const checkIns = [];
  const withdrawals = [];
  const liveHistories = [];
  const reports = [];
  const blocks = [];

  //moves coins from a user to a host the same way the backend does
  const settle = (user, host, amount) => {
    const adminCoin = round2((amount * adminRate) / 100);
    const hostCoin = round2(amount - adminCoin);
    let agencyCoin = 0;
    const agency = host.agencyId ? agencyById.get(String(host.agencyId)) : null;
    if (agency) {
      agencyCoin = agency.commissionType === 1 ? round2((hostCoin * agency.commission) / 100) : 0;
      agency.hostCoins = round2(agency.hostCoins + hostCoin);
      agency.totalEarnings = round2(agency.totalEarnings + agencyCoin);
      agency.netAvailableEarnings = round2(agency.netAvailableEarnings + hostCoin + agencyCoin);
      agency.totalEarningsWithCommissionAndHostCoin = round2(agency.totalEarningsWithCommissionAndHostCoin + hostCoin + agencyCoin);
    }
    user.coin = round2(user.coin - amount);
    user.spentCoins = round2(user.spentCoins + amount);
    host.coin = round2(host.coin + hostCoin);
    return { userCoin: amount, hostCoin, adminCoin, agencyCoin, agencyId: host.agencyId };
  };

  const notify = (target, title, message, at) =>
    notifications.push({ ...target, title, message, image: "", date: dateStr(at), createdAt: at });

  for (const user of customers) {
    const joined = user.createdAt.getTime();
    histories.push({ uniqueId: historyId(), type: 1, userId: user._id, userCoin: loginBonus, date: dateStr(user.createdAt), createdAt: user.createdAt });

    //coin plan purchases
    const purchases = chance(0.7) ? rand(1, 4) : 0;
    for (let i = 0; i < purchases && activeCoinPlans.length; i++) {
      const plan = pick(activeCoinPlans);
      const at = between(joined, NOW);
      user.coin += plan.coins;
      user.rechargedCoins += plan.coins;
      histories.push({ uniqueId: historyId(), type: 7, userId: user._id, userCoin: plan.coins, bonusCoins: 0, price: plan.price, paymentGateway: pick(["Razorpay", "Razorpay", "Stripe", "Google Play"]), date: dateStr(at), createdAt: at });
      notify({ user: user._id, notificationPersonType: 1 }, "🪙 Coins Added Successfully!", `💰 Awesome! ${plan.coins} coins have been credited to your wallet. Enjoy the fun! ✨`, at);
    }

    //vip
    if (purchases > 0 && chance(0.3) && activeVipPlans.length) {
      const plan = pick(activeVipPlans);
      const at = daysAgo(0, Math.min(25, (NOW - joined) / DAY));
      user.isVip = true;
      user.vipPlanStartDate = at.toISOString();
      user.vipPlanEndDate = moment(at).add(plan.validity, plan.validityType).toISOString();
      user.vipPlanId = plan._id;
      user.vipPlan = { validity: plan.validity, validityType: plan.validityType, coin: plan.coin, price: plan.price };
      user.coin += plan.coin;
      user.rechargedCoins += plan.coin;
      histories.push({ uniqueId: historyId(), type: 8, userId: user._id, userCoin: plan.coin, bonusCoins: 0, validity: plan.validity, validityType: plan.validityType, price: plan.price, paymentGateway: pick(["Razorpay", "Stripe"]), date: dateStr(at), createdAt: at });
      notify({ user: user._id, notificationPersonType: 1 }, "👑 VIP Plan Activated!", `✨ Welcome to VIP! Your plan is active and ${plan.coin} coins have been credited to your wallet.`, at);
    }

    //daily check-in streak
    if (chance(0.45) && dailyRewards.length) {
      const streak = rand(1, Math.min(7, dailyRewards.length));
      const rewardsCollected = [];
      for (let d = 1; d <= streak; d++) {
        const at = new Date(NOW - (streak - d) * DAY - rand(0, 6) * 60 * 60 * 1000);
        const reward = dailyRewards.find((r) => r.day === d)?.dailyRewardCoin || 0;
        rewardsCollected.push({ day: d, isCheckIn: true, reward, checkInDate: at });
        user.coin += reward;
        histories.push({ uniqueId: historyId(), type: 6, userId: user._id, userCoin: reward, date: dateStr(at), createdAt: at });
      }
      const last = rewardsCollected[rewardsCollected.length - 1].checkInDate;
      checkIns.push({ userId: user._id, lastCheckInDate: last, consecutiveDays: streak, rewardsCollected, createdAt: rewardsCollected[0].checkInDate, updatedAt: last });
    }

    //interactions with a few favourite hosts
    const spendLimit = user.coin * (0.35 + Math.random() * 0.55);
    for (const host of sample(liveHosts, rand(2, 7))) {
      const from = Math.max(joined, host.createdAt.getTime());
      const affordable = () => user.spentCoins < spendLimit;

      if (chance(0.75)) {
        const at = between(from, NOW);
        follows.push({ followerId: user._id, followingId: host._id, createdAt: at });
      }

      //chat thread
      const topic = { _id: oid(), senderId: user._id, receiverId: host._id, chatId: null, messageCount: 0, createdAt: between(from, NOW) };
      const thread = [];
      const script = pick(CONVERSATIONS).slice(0, rand(4, 10));
      let cursor = topic.createdAt.getTime();
      let paidMessages = 0;
      script.forEach(([who, message], index) => {
        cursor += rand(20, 900) * 1000;
        thread.push({ at: new Date(cursor), doc: { senderId: who === "u" ? user._id : host._id, messageType: 1, message } });
        if (who === "u" && index >= maxFreeChat && paidMessages < 3 && affordable() && user.coin >= host.chatRate) {
          paidMessages++;
          histories.push({ uniqueId: historyId(), type: 9, userId: user._id, hostId: host._id, ...settle(user, host, host.chatRate), date: dateStr(cursor), createdAt: new Date(cursor) });
        }
      });

      //calls
      const calls = rand(0, 4);
      for (let i = 0; i < calls; i++) {
        const isRandom = chance(0.15);
        const isVideo = isRandom || chance(0.65);
        const rate = isRandom ? host.randomCallMaleRate : isVideo ? host.privateCallRate : host.audioCallRate;
        const minutes = Math.min(rand(1, 14), Math.floor(user.coin / rate));
        const start = between(Math.max(from, cursor), NOW);
        const connected = minutes >= 1 && affordable() && chance(0.8);
        const seconds = connected ? (minutes - 1) * 60 + rand(5, 59) : 0;
        const end = new Date(start.getTime() + seconds * 1000);
        const duration = moment.utc(seconds * 1000).format("HH:mm:ss");
        const call = {
          _id: oid(),
          uniqueId: historyId(),
          type: isRandom ? 13 : isVideo ? 12 : 11,
          userId: user._id,
          hostId: host._id,
          agencyId: host.agencyId,
          callType: isVideo ? "video" : "audio",
          isRandom,
          isPrivate: !isRandom,
          callConnect: false,
          callStartTime: connected ? moment(start).tz(TZ).format() : "",
          callEndTime: moment(end).tz(TZ).format(),
          duration,
          ...(connected ? settle(user, host, rate * minutes) : {}),
          date: dateStr(start),
          createdAt: start,
          updatedAt: end,
        };
        histories.push(call);
        thread.push({
          at: start,
          doc: {
            senderId: user._id,
            messageType: isVideo ? 6 : 5,
            message: isVideo ? "📽 Video Call" : "📞 Audio Call",
            callId: call._id,
            callType: connected ? 1 : pick([2, 3]),
            callDuration: connected ? duration : "",
          },
        });
      }

      //gifts
      const giftsSent = activeGifts.length ? rand(0, 3) : 0;
      for (let i = 0; i < giftsSent; i++) {
        const gift = pick(activeGifts.filter((g) => g.coin <= 500).length && chance(0.85) ? activeGifts.filter((g) => g.coin <= 500) : activeGifts);
        const giftCount = gift.coin <= 50 ? pick([1, 1, 2, 5]) : 1;
        const total = gift.coin * giftCount;
        if (!affordable() || user.coin < total) continue;
        const at = between(Math.max(from, topic.createdAt.getTime()), NOW);
        const type = pick([10, 10, 10, 3, 2]);
        histories.push({
          uniqueId: historyId(),
          type,
          userId: user._id,
          hostId: host._id,
          giftId: gift._id,
          giftCount,
          giftCoin: gift.coin,
          giftType: gift.type,
          giftImage: gift.image,
          giftsvgaImage: gift.svgaImage || "",
          ...settle(user, host, total),
          date: dateStr(at),
          createdAt: at,
        });
        host.totalGifts += giftCount;
        if (type === 10) {
          thread.push({ at, doc: { senderId: user._id, messageType: 4, message: "🎁 Gift", giftType: gift.type, giftCount, giftImage: gift.image, giftsvgaImage: gift.svgaImage || "" } });
        }
      }

      thread.sort((a, b) => a.at - b.at);
      thread.forEach(({ at, doc }, index) => {
        const unread = index >= thread.length - 2 && String(doc.senderId) === String(host._id) && chance(0.5);
        chats.push({ _id: oid(), chatTopicId: topic._id, image: "", audio: "", ...doc, isRead: !unread, date: dateStr(at), createdAt: at });
      });
      const lastChat = chats[chats.length - 1];
      topic.chatId = lastChat._id;
      topic.messageCount = thread.length;
      topic.updatedAt = lastChat.createdAt;
      chatTopics.push(topic);
    }

    user.coin = round2(Math.max(user.coin, 0));
  }

  //host side: past live sessions, withdrawals, notifications
  for (const host of liveHosts) {
    const from = host.createdAt.getTime();
    if (!host.isFake) {
      notify({ host: host._id, notificationPersonType: 2 }, "🎉 Host Request Approved", "Congratulations! Your host profile has been verified. You can start receiving calls now.", new Date(from + rand(2, 20) * 60 * 60 * 1000));
    }

    for (let i = rand(0, 3); i > 0; i--) {
      const start = between(from, NOW - 2 * 60 * 60 * 1000);
      const seconds = rand(8, 95) * 60 + rand(0, 59);
      const end = new Date(start.getTime() + seconds * 1000);
      const giftCount = rand(0, 25);
      liveHistories.push({
        hostId: host._id,
        coins: giftCount * pick([10, 20, 50, 99]),
        gifts: giftCount,
        audienceCount: rand(12, 480),
        liveComments: rand(20, 900),
        startTime: moment(start).tz(TZ).format(),
        endTime: moment(end).tz(TZ).format(),
        duration: moment.utc(seconds * 1000).format("HH:mm:ss"),
        createdAt: start,
        updatedAt: end,
      });
    }

    const minPayout = setting.minCoinsForHostPayout || 100;
    if (!host.isFake && host.coin > Math.max(minPayout, 300) && chance(0.6) && paymentMethods.length) {
      const method = pick(paymentMethods);
      const status = pick([1, 1, 2, 2, 2, 3]);
      const coin = Math.floor((host.coin * (0.3 + Math.random() * 0.5)) / 10) * 10;
      const amount = Number((coin / coinsPerUnit).toFixed(2));
      const at = between(Math.max(from, NOW - 20 * DAY), NOW);
      const decidedAt = status === 1 ? null : between(at.getTime(), NOW);
      const id = historyId();
      const holder = host.name;
      const sampleValues = {
        "UPI ID": `${slug(holder).replace(/\./g, "")}@okhdfcbank`,
        "Account Holder Name": holder,
        "Account Number": String(rand(10000000000, 99999999999)),
        "IFSC Code": `HDFC000${rand(1000, 9999)}`,
        "Bank Name": "HDFC Bank",
        "PayPal Email": host.email,
      };
      withdrawals.push({
        person: 2,
        agencyOwnerId: host.agencyId,
        hostId: host._id,
        uniqueId: id,
        status,
        coin,
        amount,
        paymentGateway: method.name,
        paymentDetails: Object.fromEntries((method.details || []).map((label) => [label, sampleValues[label] || holder])),
        reason: status === 3 ? "Payment details could not be verified." : "",
        requestDate: dateStr(at),
        acceptOrDeclineDate: decidedAt ? dateStr(decidedAt) : "",
        createdAt: at,
        updatedAt: decidedAt || at,
      });
      histories.push({ uniqueId: id, type: 5, hostId: host._id, agencyId: host.agencyId, hostCoin: coin, payoutStatus: status, reason: status === 3 ? "Payment details could not be verified." : "", date: dateStr(at), createdAt: at, updatedAt: decidedAt || at });
      if (status === 2) {
        host.coin = round2(host.coin - coin);
        host.redeemedCoins += coin;
        host.redeemedAmount = round2(host.redeemedAmount + amount);
        notify({ host: host._id, notificationPersonType: 2 }, "✅ Withdrawal Approved", `Your withdrawal request of ${coin} coins has been approved and paid.`, decidedAt);
      }
    }
  }

  //a few reports and blocks so the admin panel has something to review
  const reasonTitles = reportReasons.map((r) => r.title).filter(Boolean);
  for (const user of sample(customers, 8)) {
    const host = pick(liveHosts);
    const at = between(Math.max(user.createdAt.getTime(), host.createdAt.getTime()), NOW);
    const solved = chance(0.4);
    const hostReporting = chance(0.4);
    reports.push({
      reporterId: hostReporting ? host._id : user._id,
      reporterRole: hostReporting ? "host" : "user",
      targetId: hostReporting ? user._id : host._id,
      targetRole: hostReporting ? "user" : "host",
      reason: pick(reasonTitles) || "Inappropriate behaviour",
      status: solved ? 2 : 1,
      proceedAt: solved ? between(at.getTime(), NOW) : null,
      createdAt: at,
    });
  }
  const blockedPairs = new Set();
  for (const user of sample(customers, 5)) {
    const host = pick(liveHosts);
    const key = `${user._id}:${host._id}`;
    if (blockedPairs.has(key)) continue;
    blockedPairs.add(key);
    const byHost = chance(0.5);
    blocks.push({ userId: user._id, hostId: host._id, isUserBlocked: byHost, isHostBlocked: !byHost, createdAt: daysAgo(0, 20) });
  }

  //------------------------------------------------ write
  console.log("People and activity:");
  await insert(Agency, agencies);
  await insert(User, users);
  await insert(Host, hosts);
  await insert(FollowerFollowing, follows);
  await insert(ChatTopic, chatTopics);
  await insert(Chat, chats);
  await insert(History, histories);
  await insert(CheckIn, checkIns);
  await insert(LiveBroadcastHistory, liveHistories);
  await insert(WithdrawalRequest, withdrawals);
  await insert(Notification, notifications);
  await insert(Report, reports);
  await insert(Block, blocks);

  const videoHostIds = hosts.filter((h) => h.isFake).map((h) => h._id);
  await followForRealUsers(users.map((u) => u._id), videoHostIds.length ? videoHostIds : liveHosts.map((h) => h._id));

  //demo (isFake) hosts are only listed when the demo-data switch is on; the running backend caches settings
  const settingDoc = await Setting.findOne().sort({ createdAt: -1 }).select("_id isDemoData").lean();
  if (settingDoc && !settingDoc.isDemoData && videoHostIds.length) {
    await Setting.updateOne({ _id: settingDoc._id }, { $set: { isDemoData: true } });
    meta.demoDataEnabledBySeed = [settingDoc._id];
    console.log("Setting isDemoData was off -> turned on. RESTART_BACKEND_REQUIRED");
  }

  const { demoDataEnabledBySeed, ...ids } = meta;
  await db.collection("seed_meta").insertOne({ _id: META_ID, createdAt: new Date(), ids, demoDataEnabledBySeed: demoDataEnabledBySeed || [] });

  console.log(
    `Done. Video hosts: ${videoHostIds.length}, photo hosts: ${liveHosts.length - videoHostIds.length}, pending requests: ${hosts.filter((h) => h.status === 1).length}, customers: ${customers.length}.`,
  );
}

//for accounts created after seeding: node scripts/seedDemoData.js --follow
async function followOnly() {
  const db = mongoose.connection.db;
  const record = await db.collection("seed_meta").findOne({ _id: META_ID });
  if (!record) {
    console.log("No seed data found. Run the seeder first.");
    return;
  }
  const seededHosts = await Host.find({ _id: { $in: record.ids.hosts || [] }, status: 2, isBlock: false }).select("_id isFake").lean();
  const videoHostIds = seededHosts.filter((h) => h.isFake).map((h) => h._id);
  const added = await followForRealUsers(record.ids.users || [], videoHostIds.length ? videoHostIds : seededHosts.map((h) => h._id));
  if (added.length) {
    await db.collection("seed_meta").updateOne({ _id: META_ID }, { $push: { "ids.followerfollowings": { $each: added.map((d) => d._id) } } });
  }
}

(async () => {
  try {
    await mongoose.connect(process.env.MongoDb_Connection_String, { serverSelectionTimeoutMS: 10000 });
    if (process.argv.includes("--reset")) await reset();
    else if (process.argv.includes("--follow")) await followOnly();
    else await seed();
  } catch (error) {
    //partial inserts are still recorded so --reset can clean them up
    if (Object.keys(meta).length && !process.argv.includes("--follow")) {
      const { demoDataEnabledBySeed, ...ids } = meta;
      await mongoose.connection.db
        .collection("seed_meta")
        .updateOne({ _id: META_ID }, { $set: { createdAt: new Date(), ids, demoDataEnabledBySeed: demoDataEnabledBySeed || [], failed: true } }, { upsert: true })
        .catch(() => {});
    }
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
