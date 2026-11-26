/**
 * Development seed: users, taxonomy, a realistic set of lost/found reports
 * (including matched pairs), private details, one completed handover and one
 * item already in the disposal queue.
 *
 *   npm run seed
 */
import { getDb, closeDb } from "../src/lib/db";
import { encrypt, hashPassword, hmac, randomId } from "../src/lib/crypto";
import { appendCustody } from "../src/lib/custody";
import { refreshAllMatches } from "../src/lib/matching/suggest";
import { runAgeing, getSettings } from "../src/lib/settings";
import { C } from "../src/models/collections";
import type {
  ClaimDoc,
  HandoverDoc,
  ItemCategoryDoc,
  ItemDoc,
  LocationDoc,
  PrivateDetailDoc,
  UserDoc,
  VerificationChallengeDoc,
} from "../src/models/types";

const DAY = 86_400_000;

function daysAgo(days: number, hour = 10): Date {
  const date = new Date(Date.now() - days * DAY);
  date.setHours(hour, (days * 17) % 60, 0, 0);
  return date;
}

async function main() {
  const db = await getDb();
  console.log("Seeding database:", db.databaseName);

  await Promise.all(Object.values(C).map((name) => db.collection(name).deleteMany({})));

  // --- users -------------------------------------------------------------
  const users: UserDoc[] = [];
  const makeUser = async (
    name: string,
    email: string,
    role: UserDoc["role"],
    department?: string,
  ) => {
    const doc: UserDoc = {
      _id: randomId(9),
      name,
      email,
      passwordHash: await hashPassword("Demo1234!"),
      role,
      department,
      active: true,
      createdAt: daysAgo(60),
    };
    users.push(doc);
    return doc;
  };

  const student = await makeUser("Asha Patel", "student@demo.local", "student", "B.Tech CSE");
  const student2 = await makeUser("Rohan Mehta", "student2@demo.local", "student", "B.Tech ECE");
  const staff = await makeUser("Dr. Nina George", "staff@demo.local", "staff", "Physics Dept");
  const security = await makeUser("Officer Kim", "security@demo.local", "security", "Security");
  const admin = await makeUser("Campus Admin", "admin@demo.local", "admin", "Administration");
  await makeUser("Sys Admin", "sysadmin@demo.local", "sysadmin", "IT");
  await db.collection<UserDoc>(C.users).insertMany(users);

  // --- categories --------------------------------------------------------
  const categories: ItemCategoryDoc[] = [];
  const cat = (name: string, parentId: string | null, attributes: string[] = []) => {
    const doc: ItemCategoryDoc = {
      _id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name,
      parentId,
      attributes,
      createdAt: new Date(),
    };
    categories.push(doc);
    return doc;
  };
  const electronics = cat("Electronics", null, ["brand", "colour"]);
  cat("Phones & Tablets", electronics._id, ["brand", "colour", "case"]);
  cat("Laptops & Chargers", electronics._id, ["brand", "colour"]);
  cat("Headphones & Audio", electronics._id, ["brand", "type"]);
  const keys = cat("Keys", null, ["keyring", "tag"]);
  const wallets = cat("Wallets & Cards", null, ["colour", "material"]);
  const bags = cat("Bags & Backpacks", null, ["colour", "brand"]);
  const books = cat("Books & Stationery", null, ["subject", "colour"]);
  const clothing = cat("Clothing & Accessories", null, ["colour", "type"]);
  const bottles = cat("Water Bottles", null, ["colour", "material"]);
  const documents = cat("Documents & IDs", null, ["type"]);
  cat("Other", null, []);
  await db.collection<ItemCategoryDoc>(C.categories).insertMany(categories);

  // --- locations ---------------------------------------------------------
  const locations: LocationDoc[] = [];
  const loc = (name: string, parent: LocationDoc | null) => {
    const doc: LocationDoc = {
      _id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name,
      parentId: parent?._id ?? null,
      path: parent ? [...parent.path, parent._id] : [],
      createdAt: new Date(),
    };
    locations.push(doc);
    return doc;
  };
  const campus = loc("Campus", null);
  const blockA = loc("Academic Block A", campus);
  const room101 = loc("Room 101", blockA);
  const lecture1 = loc("Lecture Hall 1", blockA);
  const library = loc("Library", campus);
  const groundFloor = loc("Ground Floor", library);
  const floor2 = loc("Floor 2", library);
  const readingRoom = loc("Reading Room", library);
  const hostel = loc("Hostel Block", campus);
  const mess = loc("Mess", hostel);
  const commonRoom = loc("Common Room", hostel);
  const sports = loc("Sports Complex", campus);
  const gym = loc("Gym", sports);
  const cafeteria = loc("Cafeteria", campus);
  const adminBuilding = loc("Admin Building", campus);
  const reception = loc("Reception", adminBuilding);
  const parking = loc("Parking", campus);
  const twoWheeler = loc("Two-Wheeler Parking", parking);
  const mainGround = loc("Main Ground", campus);
  void room101;
  void groundFloor;
  void commonRoom;
  await db.collection<LocationDoc>(C.locations).insertMany(locations);

  // --- items -------------------------------------------------------------
  interface SeedItem {
    type: "lost" | "found";
    title: string;
    description: string;
    category: string;
    location: string;
    daysAgo: number;
    attributes?: Record<string, string>;
    reporter: UserDoc;
    privateDetails?: [string, string][];
    images?: string[];
  }

  const seeds: SeedItem[] = [
    {
      type: "lost",
      title: "Black phone in a blue case",
      description:
        "Lost a black smartphone in a navy blue case somewhere between the library and the cafeteria. Screen has a small crack bottom left.",
      category: "phones-tablets",
      location: "floor-2",
      daysAgo: 2,
      attributes: { brand: "Nokia", colour: "black", case: "navy blue" },
      reporter: student,
    },
    {
      type: "found",
      title: "Found a black smartphone",
      description:
        "Picked up a black smartphone on a table near the library stairs. It is in a blue protective case and the screen has a small crack.",
      category: "phones-tablets",
      location: "floor-2",
      daysAgo: 1,
      attributes: { brand: "Nokia", colour: "black", case: "navy blue" },
      reporter: staff,
      privateDetails: [
        ["What is written on a sticker inside the case?", "asha-2026"],
        ["What colour is the phone's wallpaper?", "sunset orange"],
        ["Last two digits of the number taped under the battery cover?", "47"],
      ],
    },
    {
      type: "lost",
      title: "Keyring with three keys and a red tag",
      description:
        "Lost my keys with a red plastic tag and a small torch keychain, probably around the hostel mess.",
      category: "keys",
      location: "mess",
      daysAgo: 4,
      attributes: { keyring: "steel ring", tag: "red" },
      reporter: student2,
    },
    {
      type: "found",
      title: "Bundle of keys with a red tag",
      description:
        "Found a set of three keys on a steel ring with a red plastic tag and a small torch keychain near the mess counter.",
      category: "keys",
      location: "mess",
      daysAgo: 2,
      attributes: { keyring: "steel ring", tag: "red" },
      reporter: security,
      privateDetails: [
        ["Which building number is on the main key?", "Hostel C-14"],
        ["What is engraved on the torch keychain?", "GM 1998"],
      ],
    },
    {
      type: "lost",
      title: "Brown leather wallet",
      description:
        "Brown leather bifold wallet lost on campus, last seen at the cafeteria. Has cards inside.",
      category: "wallets-cards",
      location: "cafeteria",
      daysAgo: 1,
      attributes: { colour: "brown", material: "leather" },
      reporter: staff,
    },
    {
      type: "found",
      title: "Brown leather wallet found in cafeteria",
      description:
        "A brown leather bifold wallet was handed to me at the cafeteria. It has cards and some cash.",
      category: "wallets-cards",
      location: "cafeteria",
      daysAgo: 1,
      attributes: { colour: "brown", material: "leather" },
      reporter: security,
      privateDetails: [
        ["What is the first name on the library card inside?", "Nina"],
        ["How much cash was in the note pocket?", "430 rupees"],
        ["What brand is embossed inside?", "Hide & Co"],
      ],
    },
    {
      type: "lost",
      title: "Blue Herschel backpack",
      description:
        "Left my blue backpack with white drawstrings in Lecture Hall 1 after the 9am class. Textbooks inside.",
      category: "bags-backpacks",
      location: "lecture-hall-1",
      daysAgo: 3,
      attributes: { colour: "blue", brand: "Herschel" },
      reporter: student,
    },
    {
      type: "found",
      title: "Blue backpack left in Lecture Hall 1",
      description:
        "A blue backpack with white drawstrings and a Herschel label was left behind in Lecture Hall 1 after the morning lecture.",
      category: "bags-backpacks",
      location: "lecture-hall-1",
      daysAgo: 2,
      attributes: { colour: "blue", brand: "Herschel" },
      reporter: staff,
      privateDetails: [
        ["What is written on the luggage tag?", "Asha, CSE"],
        ["Which notebook is on top inside?", "DBMS lab manual"],
      ],
    },
    {
      type: "lost",
      title: "Silver laptop charger",
      description:
        "Lost a silver laptop charger with a Velcro strap, most likely in the library reading room.",
      category: "laptops-chargers",
      location: "reading-room",
      daysAgo: 6,
      attributes: { brand: "HP", colour: "silver" },
      reporter: student2,
    },
    {
      type: "found",
      title: "Laptop charger with Velcro strap",
      description:
        "Found a silver HP laptop charger wrapped with a black Velcro strap, left on a reading room desk.",
      category: "laptops-chargers",
      location: "reading-room",
      daysAgo: 3,
      attributes: { brand: "HP", colour: "silver" },
      reporter: security,
      privateDetails: [
        ["What is scratched on the adapter casing?", "RM 07"],
        ["How long is the cable when coiled?", "about one hand span"],
      ],
    },
    {
      type: "lost",
      title: "Grey metal water bottle with stickers",
      description:
        "Grey stainless steel bottle covered in travel stickers, lost at the sports complex.",
      category: "water-bottles",
      location: "gym",
      daysAgo: 5,
      attributes: { colour: "grey", material: "stainless steel" },
      reporter: student,
    },
    {
      type: "found",
      title: "Grey steel bottle with stickers",
      description:
        "Grey stainless steel water bottle with several travel stickers found beside the gym benches.",
      category: "water-bottles",
      location: "gym",
      daysAgo: 2,
      attributes: { colour: "grey", material: "stainless steel" },
      reporter: security,
      privateDetails: [
        ["Which sticker is on the cap?", "Ladakh 2024"],
        ["What is written in marker on the base?", "AP-CSE"],
      ],
    },
    {
      type: "lost",
      title: "Blue calculus textbook",
      description:
        "Lost my calculus textbook with a blue cover and pencil notes in the margin, around the library.",
      category: "books-stationery",
      location: "reading-room",
      daysAgo: 7,
      attributes: { subject: "calculus", colour: "blue" },
      reporter: student2,
    },
    {
      type: "found",
      title: "Blue textbook with pencil notes",
      description:
        "Found a blue-covered calculus textbook in the reading room, filled with pencil notes in the margins.",
      category: "books-stationery",
      location: "reading-room",
      daysAgo: 4,
      attributes: { subject: "calculus", colour: "blue" },
      reporter: staff,
      privateDetails: [
        ["What is doodled on the inside cover?", "a small rocket"],
        ["Which page has a coffee ring?", "page 214"],
      ],
    },
    {
      type: "found",
      title: "Black over-ear headphones",
      description: "Black over-ear headphones found on a bench at the main ground.",
      category: "headphones-audio",
      location: "main-ground",
      daysAgo: 9,
      attributes: { brand: "Sony", colour: "black", type: "over-ear" },
      reporter: security,
      privateDetails: [["What is written on the left ear cup in white ink?", "KJ"]],
    },
    {
      type: "lost",
      title: "Student ID card",
      description: "Lost my student ID card somewhere between reception and the parking lot.",
      category: "documents-ids",
      location: "two-wheeler-parking",
      daysAgo: 12,
      attributes: { type: "student ID" },
      reporter: student,
    },
    {
      type: "lost",
      title: "Grey hoodie",
      description: "Left a grey zip-up hoodie in the common room after evening basketball.",
      category: "clothing-accessories",
      location: "common-room",
      daysAgo: 14,
      attributes: { colour: "grey", type: "hoodie" },
      reporter: student2,
    },
    {
      type: "found",
      title: "Grey zip-up hoodie",
      description: "A grey zip-up hoodie was found draped over a chair in the hostel common room.",
      category: "clothing-accessories",
      location: "common-room",
      daysAgo: 11,
      attributes: { colour: "grey", type: "hoodie" },
      reporter: security,
      privateDetails: [["What is embroidered on the chest pocket?", "R.M."]],
    },
  ];

  const items: ItemDoc[] = [];
  for (const seed of seeds) {
    const createdAt = daysAgo(seed.daysAgo, 9);
    const item: ItemDoc = {
      _id: randomId(9),
      type: seed.type,
      title: seed.title,
      description: seed.description,
      categoryId: seed.category,
      locationId: seed.location,
      occurredAt: daysAgo(seed.daysAgo, 8),
      attributes: seed.attributes ?? {},
      images: [],
      status: "open",
      reporterId: seed.reporter._id,
      hasPrivateDetails: Boolean(seed.privateDetails?.length),
      createdAt,
      updatedAt: createdAt,
    };
    if (seed.type === "found") {
      item.custody = { locationId: seed.location, holderId: seed.reporter._id, since: createdAt };
    }
    items.push(item);

    if (seed.privateDetails?.length) {
      const detail: PrivateDetailDoc = {
        _id: item._id,
        itemId: item._id,
        ownerUserId: seed.reporter._id,
        entries: seed.privateDetails.map(([question, answer]) => ({
          id: randomId(6),
          questionEnc: encrypt(question),
          answerEnc: encrypt(answer),
        })),
        updatedAt: new Date(),
      };
      await db.collection<PrivateDetailDoc>(C.privateDetails).insertOne(detail);
    }
    if (seed.type === "found") {
      await appendCustody(db, {
        itemId: item._id,
        action: "reported",
        actorId: seed.reporter._id,
        toLocationId: seed.location,
        toHolderId: seed.reporter._id,
        note: "Report submitted through the campus app",
      });
    }
  }

  // A completed story: wallet returned to its owner (feeds the return-rate stats).
  const walletFound = items.find((item) => item.title.startsWith("Brown leather wallet found"));
  if (walletFound) {
    walletFound.status = "returned";
    walletFound.returnedToUserId = staff._id;
    walletFound.returnedAt = daysAgo(0, 16);
    walletFound.updatedAt = daysAgo(0, 16);
    walletFound.custody = { locationId: "reception", holderId: staff._id, since: daysAgo(0, 16) };

    const claim: ClaimDoc = {
      _id: randomId(8),
      itemId: walletFound._id,
      claimantId: staff._id,
      note: "The wallet is mine - I can describe what is inside.",
      status: "handed_over",
      challengeId: "",
      attempts: 1,
      correctCount: 3,
      passed: true,
      createdAt: daysAgo(1, 15),
      decidedAt: daysAgo(0, 14),
      decidedById: security._id,
      decisionNote: "Verification passed, wallet matches description",
    };
    const challenge: VerificationChallengeDoc = {
      _id: randomId(8),
      claimId: claim._id,
      itemId: walletFound._id,
      entryIds: [],
      questions: [],
      requiredCorrect: 2,
      maxAttempts: 3,
      attempts: 1,
      status: "passed",
      scores: [{ attempt: 1, correct: 3, at: daysAgo(1, 15) }],
      createdAt: daysAgo(1, 15),
    };
    claim.challengeId = challenge._id;
    await db.collection<ClaimDoc>(C.claims).insertOne(claim);
    await db.collection<VerificationChallengeDoc>(C.challenges).insertOne(challenge);

    const handover: HandoverDoc = {
      _id: randomId(9),
      claimId: claim._id,
      itemId: walletFound._id,
      claimantId: staff._id,
      securityId: security._id,
      method: "otp",
      status: "completed",
      otpHash: hmac("000000", "otp:seed"),
      otpAttempts: 0,
      createdAt: daysAgo(0, 15),
      completedAt: daysAgo(0, 16),
    };
    await db.collection<HandoverDoc>(C.handovers).insertOne(handover);

    await appendCustody(db, {
      itemId: walletFound._id,
      action: "received",
      actorId: security._id,
      fromLocationId: "cafeteria",
      toLocationId: "reception",
      toHolderId: security._id,
      note: "Wallet moved to the security desk for safekeeping",
    });
    await appendCustody(db, {
      itemId: walletFound._id,
      action: "handed_over",
      actorId: security._id,
      fromHolderId: security._id,
      toHolderId: staff._id,
      toLocationId: "reception",
      note: "OTP verified, wallet returned to owner",
    });
  }

  // One item already aged into the disposal queue.
  const hoodie = items.find((item) => item.title === "Grey hoodie");
  if (hoodie) {
    hoodie.createdAt = daysAgo(45);
    hoodie.updatedAt = daysAgo(2);
    hoodie.status = "disposal_pending";
  }

  await db.collection<ItemDoc>(C.items).insertMany(items);

  await getSettings(db);
  const matches = await refreshAllMatches(db);
  const ageing = await runAgeing(db);

  console.log(`users:            ${users.length}`);
  console.log(`categories:       ${categories.length}`);
  console.log(`locations:        ${locations.length}`);
  console.log(`items:            ${items.length}`);
  console.log(`match pairs:      ${matches.suggestions} (checked ${matches.checked})`);
  console.log(`ageing warnings:  ${ageing.warned.length}, queued: ${ageing.queued.length}`);
  console.log("");
  console.log("Demo accounts (password Demo1234!):");
  console.log("  student@demo.local   student");
  console.log("  student2@demo.local  student");
  console.log("  staff@demo.local     staff");
  console.log("  security@demo.local  security");
  console.log("  admin@demo.local     admin");
  console.log("  sysadmin@demo.local  sysadmin");
}

main()
  .then(() => closeDb())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
