const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTestClosureEmails() {
  try {
    console.log('🚀 Creating test closure emails...');
    console.log('📅 Date:', new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }));
    console.log('');

    // Test email addresses (you can change these)
    const testEmails = [
      'user1@example.com',
      'user2@example.com', 
      'admin@vapeshop.com'
    ];

    const orderName = 'הזמנה אחרונה לפני ראש השנה';
    
    console.log('📧 Queueing test closure emails...');

    // Queue closure emails for test users
    const emailPromises = testEmails.map(async (email) => {
      const emailSubject = `הזמנה קבוצתית נסגרה - ${orderName}`;
      
      const emailBody = `
שלום,

הזמנה קבוצתית "${orderName}" נסגרה.

הפריטים שלך בהזמנה:
- אלף וייפ פרי יער × 2 = ₪164
- בלו וייפ מנגו × 1 = ₪82

סה"כ לתשלום: ₪246

תשלום יש להעביר במזומן באיסוף או בפייבוקס: 0546743526

תודה על ההשתתפות!
      `.trim();

      // Queue the email in email_queue (for cron processing)
      const { error: queueError } = await supabase
        .from('email_queue')
        .insert({
          recipient_email: email,
          subject: emailSubject,
          email_type: 'general_order_close',
          status: 'pending',
          created_at: new Date().toISOString()
        });

      if (queueError) {
        console.error(`❌ Error queueing email for ${email}:`, queueError);
        return { success: false, email: email, error: queueError };
      } else {
        console.log(`✅ Queued closure email for ${email}`);
        return { success: true, email: email };
      }
    });

    // Queue system notification
    const systemEmailSubject = `סיכום הזמנה קבוצתית - ${orderName}`;
    const systemEmailBody = `
הזמנה קבוצתית "${orderName}" נסגרה.

סיכום ההזמנה:
- סטטוס: סגורה
- סה"כ הכנסות: ₪738
- מספר משתתפים: ${testEmails.length}
- מספר פריטים: 7

פירוט משתתפים:
${testEmails.map(email => `- ${email}`).join('\n')}

זמן סגירה: ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}
    `.trim();

    // Queue system notification
    const { error: systemQueueError } = await supabase
      .from('email_queue')
      .insert({
        recipient_email: 'SYSTEM_ORDER_CLOSED',
        subject: systemEmailSubject,
        email_type: 'general_order_close',
        status: 'pending',
        created_at: new Date().toISOString()
      });

    if (systemQueueError) {
      console.error('❌ Error queueing system notification:', systemQueueError);
    } else {
      console.log('✅ Queued system notification');
    }

    // Wait for all user emails to be queued
    const results = await Promise.all(emailPromises);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log('\n📊 QUEUING SUMMARY:');
    console.log(`✅ Successfully queued: ${successful} user emails`);
    console.log(`❌ Failed to queue: ${failed} user emails`);
    console.log(`📧 System notification: ${systemQueueError ? 'Failed' : 'Queued'}`);
    console.log(`🕒 Total emails queued: ${successful + (systemQueueError ? 0 : 1)}`);

    // Check final email queue status
    const { data: queueStatus } = await supabase
      .from('email_queue')
      .select('recipient_email, subject, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    console.log('\n📋 CURRENT EMAIL QUEUE (pending):');
    if (queueStatus && queueStatus.length > 0) {
      queueStatus.forEach(email => {
        console.log(`   - ${email.recipient_email}`);
        console.log(`     ${email.subject}`);
        console.log(`     Status: ${email.status}`);
        console.log('');
      });
    } else {
      console.log('   No pending emails in queue');
    }

    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Run the cron job: npm run cron');
    console.log('2. The cron will call the email service API');
    console.log('3. The email service will process these pending emails with our SYSTEM_ fix');
    console.log('4. Check email_logs table for results');

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

// Run the script
createTestClosureEmails()
  .then(() => {
    console.log('\n✅ Test closure emails created successfully!');
  })
  .catch(console.error);