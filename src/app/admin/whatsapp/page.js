'use client';

import { useState, useEffect } from 'react';
import { supabaseAdmin } from '../../../lib/supabase';

export default function WhatsAppAdminPage() {
    const [session, setSession] = useState(null);
    const [config, setConfig] = useState([]);
    const [admins, setAdmins] = useState([]);
    const [messageStats, setMessageStats] = useState(null);
    const [activityLog, setActivityLog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newAdmin, setNewAdmin] = useState({ phone: '', full_name: '' });
    const [configEdit, setConfigEdit] = useState(null);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, []);

    async function loadData() {
        try {
            // Load session status
            const { data: sessionData } = await supabaseAdmin
                .from('whatsapp_session')
                .select('*')
                .order('updated_at', { ascending: false })
                .limit(1)
                .single();
            setSession(sessionData);

            // Load configuration
            const { data: configData } = await supabaseAdmin
                .from('whatsapp_config')
                .select('*')
                .order('key');
            setConfig(configData || []);

            // Load admins
            const { data: adminsData } = await supabaseAdmin
                .from('whatsapp_admins')
                .select('*')
                .order('created_at', { ascending: false });
            setAdmins(adminsData || []);

            // Load message stats (last 24 hours)
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { data: messages } = await supabaseAdmin
                .from('whatsapp_messages')
                .select('status, message_type')
                .gte('created_at', yesterday);

            if (messages) {
                const stats = {
                    total: messages.length,
                    pending: messages.filter(m => m.status === 'pending').length,
                    sent: messages.filter(m => m.status === 'sent').length,
                    failed: messages.filter(m => m.status === 'failed').length,
                };
                setMessageStats(stats);
            }

            // Load recent activity
            const { data: activity } = await supabaseAdmin
                .from('whatsapp_activity_log')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);
            setActivityLog(activity || []);

            setLoading(false);
        } catch (error) {
            console.error('Error loading data:', error);
            setLoading(false);
        }
    }

    async function addAdmin() {
        if (!newAdmin.phone) {
            alert('נא להזין מספר טלפון');
            return;
        }

        try {
            const { error } = await supabaseAdmin
                .from('whatsapp_admins')
                .insert([newAdmin]);

            if (error) throw error;

            alert('מנהל נוסף בהצלחה');
            setNewAdmin({ phone: '', full_name: '' });
            loadData();
        } catch (error) {
            alert('שגיאה בהוספת מנהל: ' + error.message);
        }
    }

    async function toggleAdmin(id, currentStatus) {
        try {
            const { error } = await supabaseAdmin
                .from('whatsapp_admins')
                .update({ is_active: !currentStatus })
                .eq('id', id);

            if (error) throw error;
            loadData();
        } catch (error) {
            alert('שגיאה בעדכון מנהל: ' + error.message);
        }
    }

    async function updateConfig(key, value) {
        try {
            const { error } = await supabaseAdmin
                .from('whatsapp_config')
                .update({ value, updated_at: new Date().toISOString() })
                .eq('key', key);

            if (error) throw error;

            alert('הגדרה עודכנה בהצלחה');
            setConfigEdit(null);
            loadData();
        } catch (error) {
            alert('שגיאה בעדכון הגדרה: ' + error.message);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">טוען...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold mb-8 text-gray-900">🤖 ניהול בוט WhatsApp</h1>

                {/* Connection Status */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center">
                        <span className="ml-2">📱</span>
                        מצב חיבור
                    </h2>
                    {session ? (
                        <div className="space-y-2">
                            <div className="flex items-center">
                                <span className="font-medium ml-2">סטטוס:</span>
                                <span className={`px-3 py-1 rounded-full text-sm ${
                                    session.is_connected
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                }`}>
                                    {session.is_connected ? '✅ מחובר' : '❌ מנותק'}
                                </span>
                            </div>
                            {session.phone_number && (
                                <div>
                                    <span className="font-medium">מספר טלפון:</span> {session.phone_number}
                                </div>
                            )}
                            {session.last_connection && (
                                <div>
                                    <span className="font-medium">חיבור אחרון:</span>{' '}
                                    {new Date(session.last_connection).toLocaleString('he-IL')}
                                </div>
                            )}
                            {session.error_message && (
                                <div className="text-red-600">
                                    <span className="font-medium">שגיאה:</span> {session.error_message}
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-gray-600">אין מידע על חיבור. הרץ: npm run whatsapp:auth</p>
                    )}
                </div>

                {/* Message Statistics */}
                {messageStats && (
                    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center">
                            <span className="ml-2">📊</span>
                            סטטיסטיקות הודעות (24 שעות אחרונות)
                        </h2>
                        <div className="grid grid-cols-4 gap-4">
                            <div className="text-center p-4 bg-blue-50 rounded-lg">
                                <div className="text-3xl font-bold text-blue-600">{messageStats.total}</div>
                                <div className="text-sm text-gray-600">סה"כ</div>
                            </div>
                            <div className="text-center p-4 bg-yellow-50 rounded-lg">
                                <div className="text-3xl font-bold text-yellow-600">{messageStats.pending}</div>
                                <div className="text-sm text-gray-600">ממתינות</div>
                            </div>
                            <div className="text-center p-4 bg-green-50 rounded-lg">
                                <div className="text-3xl font-bold text-green-600">{messageStats.sent}</div>
                                <div className="text-sm text-gray-600">נשלחו</div>
                            </div>
                            <div className="text-center p-4 bg-red-50 rounded-lg">
                                <div className="text-3xl font-bold text-red-600">{messageStats.failed}</div>
                                <div className="text-sm text-gray-600">נכשלו</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Configuration */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center">
                        <span className="ml-2">⚙️</span>
                        הגדרות
                    </h2>
                    <div className="space-y-3">
                        {config.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-3 border rounded">
                                <div className="flex-1">
                                    <div className="font-medium">{item.key}</div>
                                    {item.description && (
                                        <div className="text-sm text-gray-500">{item.description}</div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {configEdit === item.key ? (
                                        <>
                                            <input
                                                type="text"
                                                defaultValue={item.value}
                                                className="border rounded px-2 py-1"
                                                id={`config-${item.key}`}
                                            />
                                            <button
                                                onClick={() => {
                                                    const newValue = document.getElementById(`config-${item.key}`).value;
                                                    updateConfig(item.key, newValue);
                                                }}
                                                className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                                            >
                                                שמור
                                            </button>
                                            <button
                                                onClick={() => setConfigEdit(null)}
                                                className="bg-gray-300 px-3 py-1 rounded hover:bg-gray-400"
                                            >
                                                ביטול
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-gray-700 font-mono">{item.value}</span>
                                            <button
                                                onClick={() => setConfigEdit(item.key)}
                                                className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                                            >
                                                ערוך
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Admins */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center">
                        <span className="ml-2">👨‍💼</span>
                        מנהלי בוט
                    </h2>
                    
                    {/* Add Admin Form */}
                    <div className="mb-4 p-4 bg-gray-50 rounded">
                        <h3 className="font-medium mb-2">הוסף מנהל חדש</h3>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="מספר טלפון (972XXXXXXXXX)"
                                value={newAdmin.phone}
                                onChange={(e) => setNewAdmin({ ...newAdmin, phone: e.target.value })}
                                className="border rounded px-3 py-2 flex-1"
                            />
                            <input
                                type="text"
                                placeholder="שם מלא"
                                value={newAdmin.full_name}
                                onChange={(e) => setNewAdmin({ ...newAdmin, full_name: e.target.value })}
                                className="border rounded px-3 py-2 flex-1"
                            />
                            <button
                                onClick={addAdmin}
                                className="bg-purple-500 text-white px-6 py-2 rounded hover:bg-purple-600"
                            >
                                הוסף
                            </button>
                        </div>
                    </div>

                    {/* Admins List */}
                    <div className="space-y-2">
                        {admins.map((admin) => (
                            <div key={admin.id} className="flex items-center justify-between p-3 border rounded">
                                <div>
                                    <div className="font-medium">{admin.full_name || 'ללא שם'}</div>
                                    <div className="text-sm text-gray-600">{admin.phone}</div>
                                </div>
                                <button
                                    onClick={() => toggleAdmin(admin.id, admin.is_active)}
                                    className={`px-4 py-2 rounded ${
                                        admin.is_active
                                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                    }`}
                                >
                                    {admin.is_active ? '✅ פעיל' : '❌ לא פעיל'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Activity Log */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center">
                        <span className="ml-2">📋</span>
                        לוג פעילות אחרון
                    </h2>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {activityLog.map((log) => (
                            <div key={log.id} className="p-3 border rounded text-sm">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <span className="font-medium">{log.activity_type}</span>
                                        {log.phone && <span className="text-gray-600"> - {log.phone}</span>}
                                        {log.is_admin && <span className="text-purple-600"> 👨‍💼</span>}
                                    </div>
                                    <span className="text-gray-500 text-xs">
                                        {new Date(log.created_at).toLocaleString('he-IL')}
                                    </span>
                                </div>
                                <div className="text-gray-700 mt-1">{log.description}</div>
                                {log.status === 'failed' && (
                                    <div className="text-red-600 text-xs mt-1">❌ נכשל</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
