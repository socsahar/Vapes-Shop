import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// POST - Generate PDF reports for closed general order
export async function POST(request) {
  try {
    const { orderId, reportType } = await request.json();

    if (!orderId || !reportType) {
      return NextResponse.json(
        { error: 'Order ID and report type are required' },
        { status: 400 }
      );
    }

    // Get order details with participants
    const { data: order, error: orderError } = await supabase
      .from('general_orders')
      .select(`
        *,
        creator:created_by(full_name, email, phone)
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'הזמנה קבוצתית לא נמצאה' },
        { status: 404 }
      );
    }

    // Get participants with their orders and items
    const { data: participants, error: participantsError } = await supabase
      .from('orders')
      .select(`
        id,
        user_id,
        total_amount,
        created_at
      `)
      .eq('general_order_id', orderId);

    if (participantsError) {
      console.error('Error fetching participants:', participantsError);
      return NextResponse.json(
        { error: 'Failed to fetch participants data' },
        { status: 500 }
      );
    }

    // Fetch additional data separately to avoid complex join issues
    for (let participant of participants) {
      // Get user data
      const { data: userData } = await supabase
        .from('users')
        .select('full_name, email, phone')
        .eq('id', participant.user_id)
        .single();
      
      participant.user = userData;

      // Get order items
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('id, product_id, quantity, unit_price, total_price')
        .eq('order_id', participant.id);

      // Get product details for each item
      const itemsWithProducts = [];
      for (const item of orderItems || []) {
        const { data: productData } = await supabase
          .from('products')
          .select('name, price, description, category')
          .eq('id', item.product_id)
          .single();
        
        itemsWithProducts.push({
          ...item,
          products: productData
        });
      }
      
      participant.order_items = itemsWithProducts;
    }

    // Debug logging to check data structure
    console.log('Participants data:', JSON.stringify(participants, null, 2));
    if (participants && participants.length > 0 && participants[0].order_items) {
      console.log('First order item:', JSON.stringify(participants[0].order_items[0], null, 2));
    }

    // Generate HTML content based on report type
    let htmlContent;
    let filename;
    const closedDate = new Date(order.updated_at || order.created_at);
    const dateStr = closedDate.toISOString().slice(0, 19).replace(/[:]/g, '-');

    if (reportType === 'admin') {
      htmlContent = generateAdminReportHTML(order, participants || []);
      filename = `admin_report_${dateStr}.pdf`;
    } else if (reportType === 'supplier') {
      htmlContent = generateSupplierReportHTML(order, participants || []);
      filename = `supplier_report_${dateStr}.pdf`;
    } else {
      return NextResponse.json(
        { error: 'סוג דוח לא תקין' },
        { status: 400 }
      );
    }

    // Generate PDF using Puppeteer
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });

    await browser.close();

    // Ensure we have a proper Buffer
    const properBuffer = Buffer.from(pdfBuffer);

    // Return PDF as response
    return new NextResponse(properBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': properBuffer.length.toString()
      }
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'שגיאה ביצירת דוח PDF' },
      { status: 500 }
    );
  }
}

function generateAdminReportHTML(order, participants) {
  const totalOrderAmount = participants.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0);
  const closedDate = new Date(order.updated_at || order.created_at);

  const participantRows = participants.map(participant => {
    const userItems = participant.order_items || [];
    const itemsHTML = userItems.map(item => 
      `<div class="item-card">
        <span class="item-name">${item.products?.name || 'מוצר לא ידוע'}</span>
        ${item.products?.category ? `<span class="item-category">${item.products.category}</span>` : ''}
        <span class="item-details">כמות: ${item.quantity} × ₪${item.unit_price}</span>
      </div>`
    ).join('');

    return `
      <tr class="participant-row">
        <td class="user-name">${participant.user?.full_name || 'משתמש לא ידוע'}</td>
        <td class="user-phone">
          ${participant.user?.phone ? 
            `<a href="tel:${participant.user.phone}" style="color: #667eea; text-decoration: none; direction: ltr;">${participant.user.phone}</a>` 
            : 'ללא טלפון'}
        </td>
        <td class="items-list">
          <div class="items-container">
            ${itemsHTML}
          </div>
        </td>
        <td class="amount">₪${parseFloat(participant.total_amount || 0).toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <meta charset="UTF-8">
      <title>דוח מנהל - ${order.title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Heebo', 'Arial', sans-serif;
          direction: rtl;
          text-align: right;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          padding: 30px;
          color: #333;
        }
        
        .document-container {
          max-width: 1200px;
          margin: 0 auto;
          background: white;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0,0,0,0.15);
        }
        
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 40px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        
        .header::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="2" fill="rgba(255,255,255,0.1)"/></svg>') repeat;
          animation: float 20s infinite linear;
        }
        
        @keyframes float {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
        
        .header-content {
          position: relative;
          z-index: 1;
        }
        
        .header h1 {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 10px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .header .subtitle {
          font-size: 1.2rem;
          font-weight: 300;
          opacity: 0.9;
        }
        
        .content {
          padding: 40px;
        }
        
        .section {
          margin-bottom: 40px;
          background: #f8f9fa;
          border-radius: 15px;
          padding: 30px;
          border-left: 5px solid #667eea;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        
        .section h3 {
          color: #667eea;
          font-size: 1.6rem;
          font-weight: 600;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        
        .info-item {
          background: white;
          padding: 15px 20px;
          border-radius: 10px;
          border-left: 4px solid #667eea;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        
        .info-label {
          font-weight: 600;
          color: #667eea;
          display: block;
          margin-bottom: 5px;
        }
        
        .info-value {
          color: #333;
          font-size: 1.1rem;
        }
        
        .table-container {
          background: white;
          border-radius: 15px;
          overflow: hidden;
          box-shadow: 0 5px 20px rgba(0,0,0,0.1);
          margin-top: 20px;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: auto;
        }
        
        th {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 15px 10px;
          font-weight: 600;
          font-size: 1rem;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
          white-space: nowrap;
        }
        
        .participant-row {
          transition: all 0.3s ease;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        
        .participant-row:nth-child(even) {
          background-color: #f8f9fa;
        }
        
        .participant-row:hover {
          background-color: #e3f2fd;
        }
        
        td {
          padding: 15px 10px;
          border-bottom: 1px solid #e0e0e0;
          vertical-align: top;
          word-wrap: break-word;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        
        .user-name {
          font-weight: 600;
          color: #667eea;
          font-size: 1.1rem;
          line-height: 1.4;
        }
        
        .user-phone {
          color: #666;
          font-size: 0.95rem;
        }
        
        .items-container {
          max-height: none;
          overflow-y: visible;
          max-width: 300px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        
        .item-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 8px 12px;
          margin-bottom: 6px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        
        .item-name {
          font-weight: 500;
          flex: 1;
          min-width: 120px;
          line-height: 1.3;
        }
        
        .item-category {
          background: rgba(255, 255, 255, 0.25);
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 600;
          margin: 0 6px;
          white-space: nowrap;
        }
        
        .item-details {
          font-size: 0.9rem;
          opacity: 0.9;
          margin-right: 10px;
          white-space: nowrap;
        }
        
        .amount {
          font-weight: 700;
          font-size: 1.1rem;
          color: #e74c3c;
          text-align: center;
        }
        
        .summary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          border-radius: 15px;
          text-align: center;
          margin-top: 30px;
        }
        
        .summary h3 {
          color: white;
          margin-bottom: 25px;
          font-size: 1.8rem;
        }
        
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        
        .summary-item {
          background: rgba(255,255,255,0.1);
          padding: 20px;
          border-radius: 10px;
          backdrop-filter: blur(10px);
        }
        
        .summary-label {
          font-size: 1rem;
          opacity: 0.9;
          margin-bottom: 10px;
        }
        
        .summary-value {
          font-size: 2rem;
          font-weight: 700;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .total-amount {
          font-size: 2.5rem !important;
          color: #ffd700;
        }
        
        @media print {
          body {
            background: white;
            padding: 0;
          }
          
          .document-container {
            box-shadow: none;
            border-radius: 0;
          }
          
          .participant-row:hover {
            transform: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="document-container">
        <div class="header">
          <div class="header-content">
            <h1>🏪 Vapes-Shop</h1>
            <p class="subtitle">דוח מנהל מפורט - ${closedDate.toLocaleDateString('he-IL')}</p>
          </div>
        </div>
        
        <div class="content">
          <div class="section">
            <h3>📋 פרטי ההזמנה הקבוצתית</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">כותרת ההזמנה</span>
                <span class="info-value">${order.title}</span>
              </div>
              <div class="info-item">
                <span class="info-label">תיאור</span>
                <span class="info-value">${order.description || 'ללא תיאור'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">תאריך יצירה</span>
                <span class="info-value">${new Date(order.created_at).toLocaleDateString('he-IL')}</span>
              </div>
              <div class="info-item">
                <span class="info-label">מועד סגירה</span>
                <span class="info-value">${new Date(order.deadline).toLocaleDateString('he-IL')}</span>
              </div>
              <div class="info-item">
                <span class="info-label">נוצר על ידי</span>
                <span class="info-value">${order.creator?.full_name || 'לא ידוע'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">סטטוס</span>
                <span class="info-value">${order.status === 'closed' ? 'סגור ✅' : 'פתוח 🔄'}</span>
              </div>
            </div>
          </div>

          <div class="section">
            <h3>👥 פירוט משתתפים והזמנות</h3>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>שם המשתמש</th>
                    <th>טלפון</th>
                    <th>מוצרים שהוזמנו</th>
                    <th>סכום לתשלום</th>
                  </tr>
                </thead>
                <tbody>
                  ${participantRows}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="summary">
          <h3>📊 סיכום כללי</h3>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">מספר משתתפים</div>
              <div class="summary-value">${participants.length}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">סכום כולל לגביה</div>
              <div class="summary-value total-amount">₪${totalOrderAmount.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateSupplierReportHTML(order, participants) {
  const closedDate = new Date(order.updated_at || order.created_at);
  
  // Debug logging
  console.log('Generating supplier report for participants:', participants.length);
  
  // Aggregate products by ID
  const productSummary = {};
  participants.forEach((participant, pIndex) => {
    console.log(`Participant ${pIndex} has ${participant.order_items?.length || 0} order items`);
    (participant.order_items || []).forEach((item, iIndex) => {
      console.log(`Item ${iIndex}:`, JSON.stringify(item, null, 2));
      const productId = item.product_id;
      const productName = item.products?.name || 'מוצר לא ידוע';
      const quantity = parseInt(item.quantity) || 0;
      
      console.log(`Product ID: ${productId}, Name: ${productName}, Quantity: ${quantity}`);
      
      if (!productSummary[productId]) {
        productSummary[productId] = {
          name: productName,
          totalQuantity: 0,
          category: item.products?.category || 'כללי'
        };
      }
      productSummary[productId].totalQuantity += quantity;
    });
  });

  console.log('Product summary:', JSON.stringify(productSummary, null, 2));

  const productRows = Object.values(productSummary).map(product => `
    <tr class="product-row">
      <td class="product-name">${product.name}</td>
      <td class="product-category">${product.category}</td>
      <td class="product-quantity">${product.totalQuantity}</td>
    </tr>
  `).join('');

  const totalOrderAmount = participants.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0);

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <meta charset="UTF-8">
      <title>דוח ספק - ${order.title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Heebo', 'Arial', sans-serif;
          direction: rtl;
          text-align: right;
          background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
          min-height: 100vh;
          padding: 30px;
          color: #333;
        }
        
        .document-container {
          max-width: 1200px;
          margin: 0 auto;
          background: white;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0,0,0,0.15);
        }
        
        .header {
          background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
          color: white;
          padding: 40px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        
        .header::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,10 90,90 10,90" fill="rgba(255,255,255,0.1)"/></svg>') repeat;
          animation: float 25s infinite linear;
        }
        
        @keyframes float {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
        
        .header-content {
          position: relative;
          z-index: 1;
        }
        
        .header h1 {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 10px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .header .subtitle {
          font-size: 1.2rem;
          font-weight: 300;
          opacity: 0.9;
        }
        
        .content {
          padding: 40px;
        }
        
        .section {
          margin-bottom: 40px;
          background: #f8fffe;
          border-radius: 15px;
          padding: 30px;
          border-left: 5px solid #2ecc71;
        }
        
        .section h3 {
          color: #27ae60;
          font-size: 1.6rem;
          font-weight: 600;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        
        .info-item {
          background: white;
          padding: 15px 20px;
          border-radius: 10px;
          border-left: 4px solid #2ecc71;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        
        .info-label {
          font-weight: 600;
          color: #27ae60;
          display: block;
          margin-bottom: 5px;
        }
        
        .info-value {
          color: #333;
          font-size: 1.1rem;
        }
        
        .table-container {
          background: white;
          border-radius: 15px;
          overflow: hidden;
          box-shadow: 0 5px 20px rgba(0,0,0,0.1);
          margin-top: 20px;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: auto;
        }
        
        th {
          background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
          color: white;
          padding: 15px 10px;
          font-weight: 600;
          font-size: 1rem;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
          white-space: nowrap;
        }
        
        .product-row {
          transition: all 0.3s ease;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        
        .product-row:nth-child(even) {
          background-color: #f8fffe;
        }
        
        .product-row:hover {
          background-color: #e8f8f5;
        }
        
        td {
          padding: 15px 10px;
          border-bottom: 1px solid #e0e0e0;
          vertical-align: middle;
          word-wrap: break-word;
          max-width: 250px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        
        .product-name {
          font-weight: 600;
          color: #27ae60;
          font-size: 1.1rem;
          line-height: 1.4;
          width: 45%;
        }
        
        .product-category {
          color: #666;
          font-size: 1rem;
          text-align: center;
          width: 25%;
        }
        
        .product-quantity {
          font-weight: 700;
          font-size: 1.2rem;
          color: #e74c3c;
          text-align: center;
          background: linear-gradient(135deg, #ff7675 0%, #fd79a8 100%);
          color: white;
          border-radius: 8px;
          padding: 8px 12px;
          width: 30%;
          min-width: 80px;
        }
        
        .contact-info {
          background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
          color: white;
          padding: 30px;
          border-radius: 15px;
          margin-bottom: 30px;
        }
        
        .contact-info h3 {
          color: white;
          margin-bottom: 20px;
          font-size: 1.6rem;
        }
        
        .contact-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        
        .contact-item {
          background: rgba(255,255,255,0.15);
          padding: 15px 20px;
          border-radius: 10px;
          backdrop-filter: blur(10px);
        }
        
        .contact-label {
          font-size: 0.9rem;
          opacity: 0.8;
          margin-bottom: 5px;
        }
        
        .contact-value {
          font-weight: 600;
          font-size: 1.1rem;
        }
        
        .summary {
          background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
          color: white;
          padding: 30px;
          border-radius: 15px;
          text-align: center;
        }
        
        .summary h3 {
          color: white;
          margin-bottom: 25px;
          font-size: 1.8rem;
        }
        
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        
        .summary-item {
          background: rgba(255,255,255,0.15);
          padding: 20px;
          border-radius: 10px;
          backdrop-filter: blur(10px);
        }
        
        .summary-label {
          font-size: 1rem;
          opacity: 0.9;
          margin-bottom: 10px;
        }
        
        .summary-value {
          font-size: 2rem;
          font-weight: 700;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .total-amount {
          font-size: 2.5rem !important;
          color: #ffd700;
        }
        
        @media print {
          body {
            background: white;
            padding: 0;
          }
          
          .document-container {
            box-shadow: none;
            border-radius: 0;
          }
          
          .product-row:hover {
            transform: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="document-container">
        <div class="header">
          <div class="header-content">
            <h1>📦 Vapes-Shop</h1>
            <p class="subtitle">דוח ספק מפורט - ${closedDate.toLocaleDateString('he-IL')}</p>
          </div>
        </div>
        
        <div class="content">
          <div class="section">
            <h3>📋 פרטי ההזמנה הקבוצתית</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">כותרת ההזמנה</span>
                <span class="info-value">${order.title}</span>
              </div>
              <div class="info-item">
                <span class="info-label">תיאור</span>
                <span class="info-value">${order.description || 'ללא תיאור'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">תאריך יצירה</span>
                <span class="info-value">${new Date(order.created_at).toLocaleDateString('he-IL')}</span>
              </div>
              <div class="info-item">
                <span class="info-label">מועד סגירה</span>
                <span class="info-value">${new Date(order.deadline).toLocaleDateString('he-IL')}</span>
              </div>
            </div>
          </div>

          <div class="section">
            <h3>📊 סיכום מוצרים וכמויות להזמנה</h3>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>שם המוצר</th>
                    <th>קטגוריה</th>
                    <th>כמות כוללת נדרשת</th>
                  </tr>
                </thead>
                <tbody>
                  ${productRows}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="contact-info">
          <h3>📞 פרטי התקשרות לביצוע ההזמנה</h3>
          <div class="contact-grid">
            <div class="contact-item">
              <div class="contact-label">איש קשר</div>
              <div class="contact-value">${order.creator?.full_name || 'לא ידוע'}</div>
            </div>
            <div class="contact-item">
              <div class="contact-label">אימייל</div>
              <div class="contact-value">${order.creator?.email || 'לא ידוע'}</div>
            </div>
            <div class="contact-item">
              <div class="contact-label">טלפון</div>
              <div class="contact-value">${order.creator?.phone || 'לא ידוע'}</div>
            </div>
            <div class="contact-item">
              <div class="contact-label">חברה</div>
              <div class="contact-value">Vapes-Shop Ltd.</div>
            </div>
          </div>
        </div>
              <div class="contact-value">Vapes-Shop Ltd.</div>
            </div>
          </div>
        </div>

        <div class="summary">
          <h3>💰 סיכום כספי ותשלום</h3>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">מספר משתתפים</div>
              <div class="summary-value">${participants.length}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">סכום כולל לקבלה</div>
              <div class="summary-value total-amount">₪${totalOrderAmount.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}