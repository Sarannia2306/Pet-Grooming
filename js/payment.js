import { auth, database, ref, get, update } from './firebase-config.js';

const qs = (s,d=document)=>d.querySelector(s);
function fmt(n){ return `MYR ${Number(n||0).toFixed(2)}`; }
function show(msg, ok=false){ const el=qs('#statusMsg'); if(!el) return; el.textContent=msg||''; el.style.display = msg? 'block':'none'; el.className = 'alert' + (ok?' ok':''); }

function getQueryParam(key){ const u=new URL(window.location.href); return u.searchParams.get(key); }

async function loadPayment(){
  try{
    const payId = getQueryParam('pay');
    if(!payId){ show('Missing payment ID.'); disable(); return null; }
    const snap = await get(ref(database, `payments/${payId}`));
    if(!snap.exists()){ show('Payment not found.'); disable(); return null; }
    const pay = snap.val();

    // Check if user is signed in
    const user = auth.currentUser;
    if(!user){ show('Please sign in first.'); disable(); return null; }
    if (pay.userId && pay.userId !== user.uid){ show('You are not authorized for this payment.'); disable(); return null; }

    // Load invoice info
    const invSnap = pay.invoiceId ? await get(ref(database, `invoices/${pay.invoiceId}`)) : null;
    const inv = invSnap?.exists() ? invSnap.val() : null;

    qs('#apptId').textContent = pay.appointmentId || '-';
    qs('#invId').textContent = inv?.number || pay.invoiceId || '-';
    qs('#amount').textContent = fmt(pay.amount);

    const btn = qs('#payNowBtn');

    if (pay.status === 'paid'){
      btn.disabled = true;
      show('This payment has already been completed.', true);
      return { pay, inv };
    }

    // Manual Card Payment Simulation
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try{
        await update(ref(database, `payments/${payId}`), { status: 'paid', paidAt: new Date().toISOString(), provider: 'card' });
        if (pay.invoiceId){ await update(ref(database, `invoices/${pay.invoiceId}`), { status: 'paid', paidAt: new Date().toISOString() }); }
        if (pay.appointmentId){ await update(ref(database, `appointments/${pay.appointmentId}`), { status: 'cancelled', cancelledAt: new Date().toISOString(), cancelReason: 'user_paid_fee' }); }
        show('Card payment successful. Your appointment has been cancelled.', true);
        setTimeout(()=>{ window.location.href = 'dashboard.html'; }, 1200);
      } catch(e){ console.error(e); show('Failed to complete payment. Please try again.'); btn.disabled = false; }
    });

    // Initialize PayPal Sandbox Buttons
    if (window.paypal && qs('#paypal-buttons')){
      window.paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },
        createOrder: (data, actions) => {
          return actions.order.create({
            purchase_units: [{
              amount: {
                currency_code: 'MYR',
                value: String(Number(pay.amount || 0).toFixed(2))
              },
              description: `Cancellation Fee for Appointment ${pay.appointmentId || ''}`
            }]
          });
        },
        onApprove: async (data, actions) => {
          try {
            const details = await actions.order.capture();
            const orderId = details.id || data.orderID;

            // Update Firebase after PayPal success
            await update(ref(database, `payments/${payId}`), {
              status: 'paid',
              paidAt: new Date().toISOString(),
              provider: 'paypal',
              providerOrderId: orderId
            });

            if (pay.invoiceId){
              await update(ref(database, `invoices/${pay.invoiceId}`), {
                status: 'paid',
                paidAt: new Date().toISOString()
              });
            }

            if (pay.appointmentId){
              await update(ref(database, `appointments/${pay.appointmentId}`), {
                status: 'cancelled',
                cancelledAt: new Date().toISOString(),
                cancelReason: 'user_paid_fee'
              });
            }

            show('PayPal payment successful. Your appointment has been cancelled.', true);
            setTimeout(()=>{ window.location.href = 'dashboard.html'; }, 1500);
          } catch(e){
            console.error('PayPal payment error:', e);
            show('Failed to process PayPal payment. Please try again.');
          }
        },
        onError: (err) => {
          console.error('PayPal SDK Error:', err);
          show('PayPal encountered an error. Try again or use card payment.');
        }
      }).render('#paypal-buttons');
    }

    return { pay, inv };
  } catch(e){ console.error(e); show('Failed to load payment details.'); disable(); return null; }
}

function disable(){ const btn=qs('#payNowBtn'); if(btn) btn.disabled=true; }

document.addEventListener('DOMContentLoaded', loadPayment);
