import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Send email directly via Resend API with PDF attachments
async function sendEmailWithResend(mailOptions) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured. Email service unavailable.');
  }

  try {
    console.log(`Sending email via Resend to:`, mailOptions.to);
    
    // Prepare attachments for Resend format
    const attachments = mailOptions.attachments ? mailOptions.attachments.map((attachment, index) => {
      // Ensure content is a proper Buffer for base64 encoding
      const buffer = Buffer.isBuffer(attachment.content) 
        ? attachment.content 
        : Buffer.from(attachment.content);
      
      console.log(`📎 Processing attachment ${index + 1}: ${attachment.filename} (${buffer.length} bytes)`);
      
      return {
        filename: attachment.filename,
        content: buffer.toString('base64'),
        content_type: attachment.contentType || 'application/pdf'
      };
    }) : [];

    if (attachments.length > 0) {
      console.log(`📧 Sending email with ${attachments.length} attachments to:`, mailOptions.to);
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.SENDER_EMAIL || 'noreply@vapes-shop.top',
        to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
        subject: mailOptions.subject,
        html: mailOptions.html,
        attachments: attachments.length > 0 ? attachments : undefined
      })
    });

    if (resendResponse.ok) {
      const resendData = await resendResponse.json();
      console.log('✅ Email sent successfully via Resend API');
      return { success: true, messageId: resendData.id, service: 'Resend API' };
    } else {
      const resendError = await resendResponse.json();
      console.error('❌ Resend API failed:', resendError);
      throw new Error(`Resend API failed: ${resendError.message || JSON.stringify(resendError)}`);
    }
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
}

// Import PDF generation functions (reuse from generate-pdf route)
async function generatePDFBuffer(htmlContent) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--font-render-hinting=none'
      ]
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      },
      printBackground: true
    });

    // Ensure we return a proper Node.js Buffer
    return Buffer.from(pdfBuffer);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function fetchOrderData(orderId) {
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
    throw new Error('הזמנה קבוצתית לא נמצאה');
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
    throw new Error('Failed to fetch participants data');
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

  return { order, participants };
}

// Import HTML generation functions from the generate-pdf route
function generateAdminReportHTML(order, participants) {
  const closedDate = new Date(order.updated_at || order.created_at);
  const totalParticipants = participants.length;
  const totalOrderAmount = participants.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0);

  const participantRows = participants.map((participant, index) => {
    const itemsHTML = (participant.order_items || []).map(item => `
      <div class="item-card">
        <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
          <span class="item-name">${item.products?.name || 'מוצר לא ידוע'}</span>
          ${item.products?.category ? `<span class="item-category">${item.products.category}</span>` : ''}
        </div>
        <span class="item-details">כמות: ${item.quantity}</span>
      </div>
    `).join('');

    return `
      <tr class="participant-row">
        <td>${index + 1}</td>
        <td>
          <div class="user-name">${participant.user?.full_name || 'לא ידוע'}</div>
          <div class="user-phone">${participant.user?.phone || 'לא צוין'}</div>
        </td>
        <td>
          <div class="items-container">
            ${itemsHTML || '<div class="no-items">אין פריטים</div>'}
          </div>
        </td>
        <td class="amount">₪${participant.total_amount || 0}</td>
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
        
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: auto;
        }
        
        tbody {
          page-break-inside: avoid;
          break-inside: avoid;
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
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          -webkit-column-break-inside: avoid !important;
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
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          -webkit-column-break-inside: avoid !important;
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
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          -webkit-column-break-inside: avoid !important;
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
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          -webkit-column-break-inside: avoid !important;
        }
        
        .item-name {
          font-weight: 500;
          flex: 1;
          min-width: 120px;
          line-height: 1.3;
        }
        
        .item-category {
          display: inline-block;
          background: rgba(255, 255, 255, 0.3);
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
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
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .info-label {
          font-weight: 600;
          color: #667eea;
          margin-bottom: 5px;
        }
        
        .info-value {
          font-size: 1.1rem;
          font-weight: 500;
        }
        
        .summary-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-top: 30px;
        }
        
        .stat-card {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          padding: 25px;
          border-radius: 15px;
          text-align: center;
          box-shadow: 0 8px 25px rgba(40, 167, 69, 0.3);
        }
        
        .stat-number {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 5px;
        }
        
        .stat-label {
          font-size: 1rem;
          opacity: 0.9;
        }
      </style>
    </head>
    <body>
      <div class="document-container">
        <div class="header">
          <div class="header-content">
            <h1>דוח מנהל - הזמנה קבוצתית</h1>
            <div class="subtitle">${order.title}</div>
          </div>
        </div>
        
        <div class="content">
          <div class="section">
            <h3>📋 פרטי ההזמנה הקבוצתית</h3>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">כותרת ההזמנה</div>
                <div class="info-value">${order.title}</div>
              </div>
              <div class="info-item">
                <div class="info-label">תיאור</div>
                <div class="info-value">${order.description || 'אין תיאור'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">תאריך יצירה</div>
                <div class="info-value">${new Date(order.created_at).toLocaleDateString('he-IL')}</div>
              </div>
              <div class="info-item">
                <div class="info-label">תאריך סגירה</div>
                <div class="info-value">${new Date(order.deadline).toLocaleDateString('he-IL')} ${new Date(order.deadline).toLocaleTimeString('he-IL', {hour: '2-digit', minute: '2-digit'})}</div>
              </div>
              <div class="info-item">
                <div class="info-label">יוצר ההזמנה</div>
                <div class="info-value">${order.creator?.full_name || 'לא ידוע'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">סטטוס</div>
                <div class="info-value">${order.status === 'open' ? 'פתוח' : order.status === 'closed' ? 'סגור' : order.status}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <h3>👥 משתתפי ההזמנה (${totalParticipants})</h3>
            ${totalParticipants > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th>מס'</th>
                    <th>פרטי משתמש</th>
                    <th>פריטים</th>
                    <th>סכום</th>
                  </tr>
                </thead>
                <tbody>
                  ${participantRows}
                </tbody>
              </table>
            ` : '<p style="text-align: center; padding: 40px; color: #666;">אין משתתפים בהזמנה זו</p>'}
          </div>

          <div class="section">
            <h3>📊 סיכום</h3>
            <div class="summary-stats">
              <div class="stat-card">
                <div class="stat-number">${totalParticipants}</div>
                <div class="stat-label">משתתפים</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">₪${totalOrderAmount}</div>
                <div class="stat-label">סך הכל</div>
              </div>
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
        
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: auto;
        }
        
        th {
          background: linear-gradient(135deg, #7b1fa2 0%, #9c27b0 100%);
          color: white;
          padding: 15px 10px;
          font-weight: 600;
          font-size: 1rem;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
        }
        
        .product-name {
          width: 45%;
          max-width: 250px;
          word-wrap: break-word;
          font-weight: 600;
          color: #333;
        }
        
        .product-category {
          width: 25%;
          color: #666;
        }
        
        .product-quantity {
          width: 30%;
          text-align: center;
          font-weight: bold;
          color: #e74c3c;
        }
        
        .product-row {
          transition: all 0.3s ease;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          -webkit-column-break-inside: avoid !important;
        }
        
        .product-row:nth-child(even) {
          background-color: #f8f9fa;
        }
        
        .product-row:hover {
          background-color: #e3f2fd;
        }
        
        td {
          padding: 15px 10px;
          border-bottom: 1px solid #e0e0e0;
          vertical-align: top;
          word-wrap: break-word;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          -webkit-column-break-inside: avoid !important;
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
          border-left: 4px solid #7b1fa2;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .info-label {
          font-weight: 600;
          color: #7b1fa2;
          margin-bottom: 5px;
        }
        
        .info-value {
          font-size: 1.1rem;
          font-weight: 500;
        }
        
        .summary-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-top: 30px;
        }
        
        .stat-card {
          background: linear-gradient(135deg, #7b1fa2 0%, #9c27b0 100%);
          color: white;
          padding: 25px;
          border-radius: 15px;
          text-align: center;
          box-shadow: 0 8px 25px rgba(123, 31, 162, 0.3);
        }
        
        .stat-number {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 5px;
        }
        
        .stat-label {
          font-size: 1rem;
          opacity: 0.9;
        }
      </style>
    </head>
    <body>
      <div class="document-container">
        <div class="header">
          <div class="header-content">
            <h1>דוח ספק - הזמנה קבוצתית</h1>
            <div class="subtitle">${order.title}</div>
          </div>
        </div>
        
        <div class="content">
          <div class="section">
            <h3>📋 פרטי ההזמנה הקבוצתית</h3>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">כותרת ההזמנה</div>
                <div class="info-value">${order.title}</div>
              </div>
              <div class="info-item">
                <div class="info-label">תיאור</div>
                <div class="info-value">${order.description || 'אין תיאור'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">תאריך סגירה</div>
                <div class="info-value">${closedDate.toLocaleDateString('he-IL')} ${closedDate.toLocaleTimeString('he-IL', {hour: '2-digit', minute: '2-digit'})}</div>
              </div>
              <div class="info-item">
                <div class="info-label">משתתפים</div>
                <div class="info-value">${participants.length}</div>
              </div>
              <div class="info-item">
                <div class="info-label">ערך כללי</div>
                <div class="info-value">₪${totalOrderAmount}</div>
              </div>
              <div class="info-item">
                <div class="info-label">מוצרים שונים</div>
                <div class="info-value">${Object.keys(productSummary).length}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <h3>📦 רשימת מוצרים לספק</h3>
            ${Object.keys(productSummary).length > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th>שם המוצר</th>
                    <th>קטגוריה</th>
                    <th>כמות כוללת</th>
                  </tr>
                </thead>
                <tbody>
                  ${productRows}
                </tbody>
              </table>
            ` : '<p style="text-align: center; padding: 40px; color: #666;">אין מוצרים בהזמנה זו</p>'}
          </div>

          <div class="section">
            <h3>📊 סיכום עבור הספק</h3>
            <div class="summary-stats">
              <div class="stat-card">
                <div class="stat-number">${Object.keys(productSummary).length}</div>
                <div class="stat-label">מוצרים שונים</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">${Object.values(productSummary).reduce((sum, product) => sum + product.totalQuantity, 0)}</div>
                <div class="stat-label">פריטים בסה"כ</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">${participants.length}</div>
                <div class="stat-label">לקוחות</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">₪${totalOrderAmount}</div>
                <div class="stat-label">ערך כללי</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function getAdminEmails() {
  const { data: admins, error } = await supabase
    .from('users')
    .select('email, full_name')
    .eq('role', 'admin');
    
  if (error) {
    console.error('Error fetching admin emails:', error);
    return [];
  }
  
  return admins || [];
}

export async function POST(request) {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    console.log('Sending summary email for order:', orderId);

    // Fetch order data
    const { order, participants } = await fetchOrderData(orderId);

    // Generate PDF buffers for both reports
    const adminHtml = generateAdminReportHTML(order, participants);
    const supplierHtml = generateSupplierReportHTML(order, participants);
    
    console.log('🔄 Generating PDF buffers for order:', order.title);
    const [adminPdfBuffer, supplierPdfBuffer] = await Promise.all([
      generatePDFBuffer(adminHtml),
      generatePDFBuffer(supplierHtml)
    ]);

    // Validate PDF buffers
    if (!adminPdfBuffer || !supplierPdfBuffer) {
      throw new Error('Failed to generate one or both PDF reports');
    }

    // Validate PDF format (should start with %PDF header)
    const adminValid = adminPdfBuffer.slice(0, 4).toString() === '%PDF';
    const supplierValid = supplierPdfBuffer.slice(0, 4).toString() === '%PDF';
    
    if (!adminValid || !supplierValid) {
      throw new Error(`Invalid PDF format - Admin: ${adminValid}, Supplier: ${supplierValid}`);
    }

    console.log(`📄 PDFs generated successfully - Admin: ${adminPdfBuffer.length} bytes, Supplier: ${supplierPdfBuffer.length} bytes`);

    // Get admin email addresses
    const admins = await getAdminEmails();
    if (admins.length === 0) {
      return NextResponse.json(
        { error: 'No admin email addresses found' },
        { status: 404 }
      );
    }

    console.log('Found admin users:', admins.map(admin => `${admin.full_name} (${admin.email})`));

    // Format date for filenames
    const date = new Date(order.deadline).toISOString().slice(0, 19).replace(/:/g, '-');
    const adminFilename = `admin_report_${date}.pdf`;
    const supplierFilename = `supplier_report_${date}.pdf`;

    // Create professional email content
    const emailSubject = `סיכום הזמנה קבוצתית: ${order.title}`;
    const emailBody = `
      <div dir="rtl" style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; margin-bottom: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">📊 סיכום הזמנה קבוצתית</h1>
          <h2 style="margin: 10px 0 0 0; font-size: 20px; opacity: 0.9;">${order.title}</h2>
        </div>
        
        <div style="padding: 30px; background: white; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          <h3 style="color: #667eea; margin-bottom: 15px; font-size: 18px;">📋 פרטי ההזמנה</h3>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <ul style="margin: 0; padding-right: 20px;">
              <li style="margin-bottom: 8px;"><strong>כותרת:</strong> ${order.title}</li>
              <li style="margin-bottom: 8px;"><strong>תיאור:</strong> ${order.description || 'אין תיאור'}</li>
              <li style="margin-bottom: 8px;"><strong>תאריך יצירה:</strong> ${new Date(order.created_at).toLocaleDateString('he-IL')}</li>
              <li style="margin-bottom: 8px;"><strong>תאריך סגירה:</strong> ${new Date(order.deadline).toLocaleDateString('he-IL')} ${new Date(order.deadline).toLocaleTimeString('he-IL', {hour: '2-digit', minute: '2-digit'})}</li>
              <li style="margin-bottom: 8px;"><strong>סטטוס:</strong> ${order.status === 'open' ? 'פתוח' : order.status === 'closed' ? 'סגור' : order.status}</li>
              <li><strong>יוצר ההזמנה:</strong> ${order.creator?.full_name || 'לא ידוע'}</li>
            </ul>
          </div>

          <h3 style="color: #667eea; margin-bottom: 15px; font-size: 18px;">📊 סיכום נתונים</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 20px;">
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; flex: 1; min-width: 200px; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #1976d2;">${participants.length}</div>
              <div style="color: #666; font-size: 14px;">משתתפים</div>
            </div>
            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; flex: 1; min-width: 200px; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #2e7d32;">₪${participants.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0)}</div>
              <div style="color: #666; font-size: 14px;">סכום כולל</div>
            </div>
            <div style="background: #fff3e0; padding: 15px; border-radius: 8px; flex: 1; min-width: 200px; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #f57c00;">${Object.keys(participants.reduce((products, p) => {
                (p.order_items || []).forEach(item => {
                  if (item.product_id) products[item.product_id] = true;
                });
                return products;
              }, {})).length}</div>
              <div style="color: #666; font-size: 14px;">מוצרים שונים</div>
            </div>
          </div>

          <h3 style="color: #667eea; margin-bottom: 15px; font-size: 18px;">📎 קבצים מצורפים</h3>
          <div style="background: #f0f7ff; padding: 20px; border-radius: 8px; border-right: 4px solid #667eea; margin-bottom: 20px;">
            <p style="margin: 0 0 15px 0; font-weight: 600;">מצורפים לאימייל זה שני דוחי PDF:</p>
            <ul style="margin: 0; padding-right: 20px;">
              <li style="margin-bottom: 8px;"><strong>📊 דוח מנהל</strong> - פירוט מלא של כל המשתתפים והזמנותיהם</li>
              <li><strong>📦 דוח ספק</strong> - רשימת מוצרים מסוכמת לשליחה לספק</li>
            </ul>
          </div>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-right: 4px solid #28a745; margin-bottom: 20px;">
            <h4 style="color: #28a745; margin: 0 0 15px 0; font-size: 16px;">🔔 הוראות לביצוע</h4>
            <ol style="margin: 0; padding-right: 20px;">
              <li style="margin-bottom: 8px;">בדוק את הדוח המנהלי לאימות פרטי הזמנות</li>
              <li style="margin-bottom: 8px;">שלח את הדוח הספק לספק המתאים</li>
              <li>עקוב אחר סטטוס ההזמנה במערכת</li>
            </ol>
          </div>

          <div style="text-align: center; margin-top: 30px; padding: 20px; background: #e3f2fd; border-radius: 8px;">
            <p style="margin: 0; color: #1976d2; font-size: 14px;">
              <strong>🏪 מערכת ניהול הוייפ שופ</strong><br>
              אימייל אוטומטי - נשלח ב-${new Date().toLocaleDateString('he-IL')} ${new Date().toLocaleTimeString('he-IL')}<br>
              <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/admin" style="color: #1976d2; text-decoration: none;">
                🔗 כניסה לפאנל הניהול
              </a>
            </p>
          </div>
        </div>
      </div>
    `;

    // Send individual emails to each admin (Resend works better with individual sends)
    const emailResults = [];
    const failedEmails = [];

    for (const admin of admins) {
      try {
        console.log(`Sending summary email to: ${admin.full_name} (${admin.email})`);
        
        const mailOptions = {
          to: [admin.email], // Send to one admin at a time
          subject: emailSubject,
          html: emailBody,
          attachments: [
            {
              filename: adminFilename,
              content: adminPdfBuffer,
              contentType: 'application/pdf'
            },
            {
              filename: supplierFilename,
              content: supplierPdfBuffer,
              contentType: 'application/pdf'
            }
          ]
        };

        // Send email directly via Resend
        const emailResult = await sendEmailWithResend(mailOptions);
        emailResults.push({
          email: admin.email,
          name: admin.full_name,
          success: true,
          messageId: emailResult.messageId
        });

        // Log the successful email in database
        try {
          await supabase
            .from('email_logs')
            .insert({
              order_id: orderId,
              email_type: 'admin_summary',
              recipient_email: admin.email,
              subject: emailSubject,
              status: 'sent'
            });
        } catch (logError) {
          console.error('Error logging email for', admin.email, ':', logError);
        }

        // Small delay between emails to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (emailError) {
        console.error(`Failed to send email to ${admin.email}:`, emailError);
        failedEmails.push({
          email: admin.email,
          name: admin.full_name,
          error: emailError.message
        });
      }
    }

    const successCount = emailResults.length;
    const failCount = failedEmails.length;

    console.log(`Email sending complete: ${successCount} sent, ${failCount} failed`);
    console.log('Successful sends:', emailResults.map(r => r.email));
    if (failedEmails.length > 0) {
      console.log('Failed sends:', failedEmails.map(f => `${f.email} (${f.error})`));
    }

    if (successCount === 0) {
      return NextResponse.json(
        { 
          error: 'לא ניתן היה לשלוח אימייל לאף מנהל',
          failures: failedEmails
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `אימיילי סיכום נשלחו בהצלחה ל-${successCount} מנהלים${failCount > 0 ? ` (${failCount} נכשלו)` : ''}`,
      recipients: successCount,
      totalAdmins: admins.length,
      successfulSends: emailResults,
      failedSends: failCount > 0 ? failedEmails : undefined,
      attachments: 2,
      service: 'Resend API'
    });

  } catch (error) {
    console.error('Error sending summary email:', error);
    return NextResponse.json(
      { error: error.message || 'שגיאה בשליחת אימייל הסיכום' },
      { status: 500 }
    );
  }
}