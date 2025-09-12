import { db } from "./index";
import * as schema from "@shared/schema";
import bcrypt from "bcryptjs";

async function seed() {
  try {
    console.log("Starting database seed...");

    // Create initial users
    const hashedPassword = await bcrypt.hash("password123", 10);

    // Check if users already exist to avoid duplicates
    let users = await db.query.users.findMany();
    if (users.length === 0) {
      console.log("Creating sample users...");
      
      users = await db.insert(schema.users).values([
        {
          username: "sarah_johnson",
          email: "sarah@example.com",
          password: hashedPassword,
          name: "Sarah Johnson",
          bio: "Event organizer and community builder. I love connecting people!",
          avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=crop&w=200&q=80",
        },
        {
          username: "michael_smith",
          email: "michael@example.com",
          password: hashedPassword,
          name: "Michael Smith",
          bio: "Music enthusiast and concert promoter.",
          avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&auto=format&fit=crop&w=200&q=80",
        },
        {
          username: "emma_wilson",
          email: "emma@example.com",
          password: hashedPassword,
          name: "Emma Wilson",
          bio: "Foodie and culinary workshop host.",
          avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&auto=format&fit=crop&w=200&q=80",
        }
      ]).returning();
      
      console.log(`Created ${users.length} users`);
    } else {
      console.log(`Using ${users.length} existing users`);
    }
      
    // Check if events already exist
    const existingEvents = await db.query.events.findMany();
    if (existingEvents.length === 0) {
      // Create sample events
      console.log("Creating sample events...");
      
      const events = await db.insert(schema.events).values([
        {
          title: "Community Networking Mixer",
          description: "Join us for a relaxed networking event where entrepreneurs, creatives, and professionals can connect, share ideas, and build meaningful relationships. Light refreshments will be served.",
          category: "social",
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          latitude: "37.7749",
          longitude: "-122.4194",
          locationName: "Downtown Coworking Space",
          locationAddress: "123 Main Street, Downtown",
          paymentType: "paid",
          price: "15.00",
          maxCapacity: 50,
          privacyType: "public",
          organizerId: users[0].id,
        },
        {
          title: "Live Jazz Night",
          description: "Experience an unforgettable evening of live jazz music with talented local musicians. Food and drinks available for purchase.",
          category: "music",
          date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
          latitude: "37.7833",
          longitude: "-122.4167",
          locationName: "Blue Note Jazz Club",
          locationAddress: "456 Market St, Downtown",
          paymentType: "paid",
          price: "25.00",
          maxCapacity: 100,
          privacyType: "public",
          organizerId: users[0].id,
        },
        {
          title: "Farm-to-Table Dinner",
          description: "Join us for a unique dining experience featuring seasonal ingredients sourced directly from local farms. Meet the farmers and learn about sustainable agriculture while enjoying a delicious meal.",
          category: "food",
          date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
          latitude: "37.7694",
          longitude: "-122.4862",
          locationName: "Urban Farm Collective",
          locationAddress: "789 Green St, Sunset District",
          paymentType: "paid",
          price: "45.00",
          maxCapacity: 30,
          privacyType: "public",
          organizerId: users[0].id,
        },
        {
          title: "Morning Meditation in the Park",
          description: "Start your day with a peaceful guided meditation session in the park. All experience levels welcome. Bring your own mat or blanket.",
          category: "spiritual",
          date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
          latitude: "37.7695",
          longitude: "-122.4830",
          locationName: "Golden Gate Park",
          locationAddress: "Golden Gate Park, Conservatory of Flowers",
          paymentType: "free",
          privacyType: "public",
          organizerId: users[0].id,
        },
        {
          title: "Tech Startup Pitch Night",
          description: "Watch emerging startups pitch their innovative ideas to a panel of investors and industry experts. Networking opportunity after the presentations.",
          category: "technology",
          date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
          latitude: "37.7790",
          longitude: "-122.4190",
          locationName: "Innovation Hub",
          locationAddress: "555 Howard St, SOMA",
          paymentType: "free",
          maxCapacity: 75,
          privacyType: "public",
          organizerId: users[0].id,
        }
      ]).returning();
      
      console.log(`Created ${events.length} events`);
      
      // Add user interests
      console.log("Creating sample user interests...");
      
      const interests = await db.insert(schema.userInterests).values([
        {
          userId: users[0].id,
          category: "social",
        },
        {
          userId: users[0].id,
          category: "spiritual",
        },
        {
          userId: users[0].id,
          category: "music",
        },
        {
          userId: users[0].id,
          category: "technology",
        },
        {
          userId: users[0].id,
          category: "food",
        }
      ]).returning();
      
      console.log(`Created ${interests.length} user interests`);
    } else {
      console.log("Events already exist. Skipping event creation.");
    }
      
    console.log("Database seed completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seed();
