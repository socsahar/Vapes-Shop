const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sendClosureEmailsToAllUsers() {
  try {
    console.log('🚀 Sending closure emails to ALL users...');
    console.log('📅 Date:', new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }));
    console.log('');

    // Get ALL users from the database
    console.log('👥 Fetching all users from database...');
    const { data: allUsers, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .not('email', 'is', null);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }

    if (!allUsers || allUsers.length === 0) {
      console.log('❌ No users found in database');
      return;
    }

    console.log(`✅ Found ${allUsers.length} users in database:`);
    allUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email}`);
    });

    const orderName = 'הזמנה אחרונה לפני ראש השנה';
    
    console.log('\n📧 Queueing closure emails for ALL users...');

    // Queue closure emails for ALL users
    const emailPromises = allUsers.map(async (user) => {
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

צוות החנות
      `.trim();

      // Queue the email in email_queue (for cron processing)
      const { error: queueError } = await supabase
        .from('email_queue')
        .insert({
          recipient_email: user.email,
          subject: emailSubject,
          email_type: 'general_order_close',
          status: 'pending',
          created_at: new Date().toISOString()
        });

      if (queueError) {
        console.error(`❌ Error queueing email for ${user.email}:`, queueError);
        return { success: false, email: user.email, error: queueError };
      } else {
        console.log(`✅ Queued closure email for ${user.email}`);
        return { success: true, email: user.email };
      }
    });

    // Queue system notification
    const systemEmailSubject = `סיכום הזמנה קבוצתית - ${orderName}`;
    const systemEmailBody = `
הזמנה קבוצתית "${orderName}" נסגרה.

📊 סיכום ההזמנה:
- סטטוס: סגורה
- מספר משתתפים: ${allUsers.length}
- הכנסות צפויות: ₪${allUsers.length * 246}

👥 פירוט כל המשתתפים:
${allUsers.map((user, index) => `${index + 1}. ${user.email}`).join('\n')}

🕒 זמן סגירה: ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}

📧 נשלחו ${allUsers.length} הודעות סגירה למשתתפים
    `.trim();

    // Queue system notification
    const { error: systemQueueError } = await supabase
      .from('email_queue')
      .insert({
        recipient_email: 'SYSTEM_ORDER_CLOSED',
        subject: systemEmailSubject,
        email_type: 'system_notification',
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

    console.log('\n📊 MASS EMAIL QUEUING SUMMARY:');
    console.log(`✅ Successfully queued: ${successful} user emails`);
    console.log(`❌ Failed to queue: ${failed} user emails`);
    console.log(`📧 System notification: ${systemQueueError ? 'Failed' : 'Queued'}`);
    console.log(`🕒 Total emails queued: ${successful + (systemQueueError ? 0 : 1)}`);
    console.log(`💰 Total expected revenue: ₪${successful * 246}`);

    if (failed > 0) {
      console.log('\n❌ Failed emails:');
      const failedResults = results.filter(r => !r.success);
      failedResults.forEach(result => {
        console.log(`   - ${result.email}: ${result.error?.message || 'Unknown error'}`);
      });
    }

    // Check final email queue status
    const { data: queueStatus } = await supabase
      .from('email_queue')
      .select('recipient_email, subject, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(15);

    console.log('\n📋 CURRENT EMAIL QUEUE (pending - showing last 15):');
    if (queueStatus && queueStatus.length > 0) {
      queueStatus.forEach((email, index) => {
        console.log(`   ${index + 1}. ${email.recipient_email}`);
        console.log(`      ${email.subject}`);
        console.log(`      Status: ${email.status}`);
        console.log('');
      });
      
      if (queueStatus.length === 15) {
        console.log('   ... (showing only last 15 entries)');
      }
    } else {
      console.log('   No pending emails in queue');
    }

    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Run the cron job: npm run cron');
    console.log('2. The cron will call the email service API');
    console.log('3. The email service will process ALL these pending emails with our SYSTEM_ fix');
    console.log('4. Check email_logs table for results');
    console.log('5. All users will receive closure notifications!');

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

// Run the script
console.log('🌍 MASS CLOSURE EMAIL CAMPAIGN');
console.log('===============================');
sendClosureEmailsToAllUsers()
  .then(() => {
    console.log('\n✅ Mass closure email campaign completed successfully!');
    console.log('🚀 Ready to send to ALL users!');
  })
  .catch(console.error);