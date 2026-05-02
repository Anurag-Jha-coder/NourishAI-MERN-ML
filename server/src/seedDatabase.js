const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Food = require('./models/Food');

async function seedDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not found in .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    // Clear existing
    await Food.deleteMany({});
    console.log('Cleared existing Food collection');

    const filesToSeed = [
      path.join(__dirname, '../../ml/data/enriched_foods.csv'),
      path.join(__dirname, '../../ml/data/enriched_indian_foods.csv')
    ];

    let totalFoods = [];

    for (const csvPath of filesToSeed) {
      if (fs.existsSync(csvPath)) {
        const fileFoods = await new Promise((resolve) => {
          const rows = [];
          fs.createReadStream(csvPath)
            .pipe(csv())
            .on('data', (row) => {
              try {
                const parseArray = (str) => {
                  if (!str) return [];
                  try {
                    return JSON.parse(str.replace(/'/g, '"'));
                  } catch (e) {
                    return [];
                  }
                };

                rows.push({
                  name: row.name,
                  calories: parseFloat(row.calories),
                  protein: parseFloat(row.protein),
                  carbs: parseFloat(row.carbs),
                  fat: parseFloat(row.fat),
                  fiber: parseFloat(row.fiber || 0),
                  sugar: parseFloat(row.sugar || 0),
                  category: row.category,
                  diet_type: row.diet_type,
                  region: row.region,
                  meal_type: parseArray(row.meal_type),
                  health_tags: parseArray(row.health_tags),
                  glycemic_index: row.glycemic_index,
                });
              } catch (err) {}
            })
            .on('end', () => resolve(rows));
        });
        
        totalFoods = totalFoods.concat(fileFoods);
        console.log(`Successfully parsed ${fileFoods.length} items from ${path.basename(csvPath)}`);
      } else {
        console.warn(`File not found: ${csvPath}`);
      }
    }

    try {
      await Food.insertMany(totalFoods);
      console.log(`✅ Successfully seeded ${totalFoods.length} items to MongoDB!`);
    } catch (insertErr) {
      console.error('Error inserting into DB:', insertErr);
    } finally {
      mongoose.disconnect();
      process.exit(0);
    }
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
}

seedDatabase();
