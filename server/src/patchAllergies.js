const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Food = require('./models/Food');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nourishai';

async function patchAllergies() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected');

    // Rules
    const rules = [
      {
        tag: 'contains-lactose',
        regex: /milk|cheese|paneer|butter|ghee|cream|curd|yogurt|whey/i
      },
      {
        tag: 'contains-gluten',
        regex: /wheat|bread|roti|naan|paratha|kulcha|pasta|pizza|flour|noodle|biscuit|cake|cookie|pastry|puri/i
      },
      {
        tag: 'contains-nuts',
        regex: /peanut|almond|cashew|walnut|pecan|macadamia|pistachio|nut/i
      },
      {
        tag: 'contains-soy',
        regex: /soy|tofu|edamame|tempeh/i
      }
    ];

    for (const rule of rules) {
      console.log(`Patching ${rule.tag}...`);
      const result = await Food.updateMany(
        { 
          name: { $regex: rule.regex },
          health_tags: { $ne: rule.tag } // Only add if not already there
        },
        {
          $addToSet: { health_tags: rule.tag }
        }
      );
      console.log(`   -> Modified ${result.modifiedCount} foods with ${rule.tag}`);
    }

    console.log('🎉 Done patching allergens!');

  } catch (error) {
    console.error('Error patching DB:', error);
  } finally {
    mongoose.disconnect();
    process.exit(0);
  }
}

patchAllergies();
