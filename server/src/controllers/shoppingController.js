const PDFDocument = require('pdfkit');
const ShoppingList = require('../models/ShoppingList');
const DietPlan = require('../models/DietPlan');
const { generateShoppingList } = require('../utils/shoppingService');

// 1. generateList - Takes dietPlanId, calls service, saves doc
exports.generateList = async (req, res) => {
  try {
    const { dietPlanId, week_number = 1 } = req.body;
    
    if (!dietPlanId) {
      return res.status(400).json({ success: false, message: 'dietPlanId is required.' });
    }

    const dietPlan = await DietPlan.findOne({ _id: dietPlanId, user: req.user._id });
    if (!dietPlan) {
      return res.status(404).json({ success: false, message: 'Diet plan not found.' });
    }

    // Call service
    const { items, total_estimated_cost } = await generateShoppingList(dietPlan);

    // Save ShoppingList doc
    const shoppingList = await ShoppingList.create({
      user: req.user._id,
      dietPlan: dietPlanId,
      week_number,
      items,
      total_estimated_cost
    });

    // Group items for the frontend response
    const grouped = items.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});

    res.status(201).json({
      success: true,
      data: {
        listId: shoppingList._id,
        week_number: shoppingList.week_number,
        total_estimated_cost: shoppingList.total_estimated_cost,
        groupedItems: grouped
      }
    });

  } catch (err) {
    console.error('generateList error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 2. togglePurchased - Flips is_purchased for a specific item
exports.togglePurchased = async (req, res) => {
  try {
    const { listId, itemIndex } = req.params;

    const shoppingList = await ShoppingList.findOne({ _id: listId, user: req.user._id });
    if (!shoppingList) {
      return res.status(404).json({ success: false, message: 'Shopping list not found.' });
    }

    if (!shoppingList.items[itemIndex]) {
      return res.status(400).json({ success: false, message: 'Invalid item index.' });
    }

    shoppingList.items[itemIndex].is_purchased = !shoppingList.items[itemIndex].is_purchased;
    await shoppingList.save();

    res.json({ success: true, is_purchased: shoppingList.items[itemIndex].is_purchased });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 3. exportPDF - Generates a structured PDF and streams it
exports.exportPDF = async (req, res) => {
  try {
    const { listId } = req.params;

    const shoppingList = await ShoppingList.findOne({ _id: listId, user: req.user._id })
      .populate('user', 'name');
      
    if (!shoppingList) {
      return res.status(404).json({ success: false, message: 'Shopping list not found.' });
    }

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=NourishAI_Shopping_Week${shoppingList.week_number}.pdf`);

    doc.pipe(res);

    // Title & Header
    doc.fontSize(20).text(`NourishAI Shopping List — Week ${shoppingList.week_number}`, { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(12).fillColor('gray')
       .text(`Name: ${shoppingList.user?.name || 'User'}`, { align: 'right' })
       .text(`Date: ${new Date(shoppingList.created_at).toLocaleDateString()}`, { align: 'right' });
    
    doc.moveDown(2);

    // Group items by category
    const grouped = shoppingList.items.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});

    // Draw sections
    for (const [category, items] of Object.entries(grouped)) {
      doc.fontSize(16).fillColor('black').text(category.toUpperCase(), { underline: true });
      doc.moveDown(0.5);

      let subtotal = 0;

      items.forEach(item => {
        subtotal += item.estimated_cost_inr;
        
        // Draw checkbox box
        const y = doc.y;
        doc.rect(50, y, 10, 10).stroke();
        
        // Draw text
        doc.fontSize(12).fillColor('black')
           .text(`${item.food_name}`, 70, y)
           .text(`${item.quantity} ${item.unit}`, 300, y)
           .text(`₹${item.estimated_cost_inr}`, 450, y);
           
        doc.moveDown(0.5);
      });

      doc.moveDown(0.5);
      doc.fontSize(12).fillColor('gray').text(`Category Subtotal: ₹${subtotal}`, { align: 'right' });
      doc.moveDown(1);
    }

    // Grand Total
    doc.moveDown(2);
    doc.fontSize(16).fillColor('black').text(`Grand Total: ₹${shoppingList.total_estimated_cost}`, { align: 'right' });

    doc.end();

  } catch (err) {
    console.error('exportPDF error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};
