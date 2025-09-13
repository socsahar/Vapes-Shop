require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTemplates() {
  console.log('Connecting to Supabase...');
  const { data: templates, error } = await supabase.from('email_templates').select('*');
  
  if (error) {
    console.error('Database error:', error);
    return;
  }
  
  console.log('Email templates in database:');
  templates?.forEach(t => {
    console.log(`\nTemplate: ${t.template_type}`);
    console.log('Subject:', t.subject_template);
    console.log('Body preview:', t.body_template?.substring(0, 300));
    const variables = t.body_template?.match(/\{\{[^}]+\}\}/g) || [];
    console.log('Variables found:', variables.join(', '));
    console.log('---');
  });
}

checkTemplates().catch(console.error);