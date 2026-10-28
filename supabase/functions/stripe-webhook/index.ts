// ConsteAi — Webhook de Stripe → activa planes y registra suscripciones en Supabase
// Eventos: checkout.session.completed (alta), invoice.paid (renovación), customer.subscription.deleted (baja)
import Stripe from "npm:stripe@14";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2024-04-10" });
const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// Mapeo por importe en céntimos (mantener sincronizado con los precios de Stripe)
function planPorImporte(cents: number): { plan: string; dias: number | null } | null {
  // Precios vigentes con IVA incluido. Se aceptan dos valores por plan porque, según
  // cómo calcule Stripe el impuesto en cada compra, puede llegar el importe con IVA
  // (19,00 €) o la base imponible (15,70 €). Así el plan se activa en ambos casos.
  if (cents === 1900 || cents === 1570) return { plan: "pro_mes", dias: 32 };
  if (cents === 19000 || cents === 15702) return { plan: "pro_anyo", dias: 367 };
  if (cents === 4500 || cents === 3719) return { plan: "empresas", dias: 32 };
  // Plan Despacho: 149 €/mes con 5 asientos (12.314 = base sin el 21 % de IVA)
  if (cents === 14900 || cents === 12314) return { plan: "despacho", dias: 32 };
  // Precios antiguos: se mantienen para que los clientes que ya pagan sigan renovando
  if (cents === 999) return { plan: "pro_mes", dias: 32 };
  if (cents === 7900) return { plan: "pro_anyo", dias: 367 };
  if (cents === 2900) return { plan: "empresas", dias: 32 };
  return null;
}

async function registrar(email: string, evento: string, plan: string, importe: number, customer: string | null) {
  await supa.from("suscripciones").insert({ email, evento, plan, importe, stripe_customer: customer });
}

async function activar(emailRaw: string, cents: number, evento: string, customer: string | null) {
  const email = (emailRaw || "").trim().toLowerCase();
  const p = planPorImporte(cents);
  if (!email || !p) { console.log("sin email o importe desconocido", emailRaw, cents); return; }
  const plan_hasta = p.dias ? new Date(Date.now() + p.dias * 86400000).toISOString() : null;

  if (p.plan === "despacho") {
    await activarDespacho(email, plan_hasta, customer);
  } else {
    const { error } = await supa.from("perfiles").update({ plan: p.plan, plan_hasta }).ilike("email", email);
    if (error) console.error("update perfil:", error);
  }
  await registrar(email, evento, p.plan, cents / 100, customer);
}

/* El pago del plan Despacho activa el despacho del que paga. Si todavía
   no había creado ninguno, se le crea uno con él como propietario y
   administrador, para que al entrar ya lo tenga listo. */
async function activarDespacho(email: string, plan_hasta: string | null, customer: string | null) {
  const { data: perfil } = await supa.from("perfiles").select("id").ilike("email", email).maybeSingle();
  if (!perfil) { console.log("despacho: sin perfil para", email); return; }
  const uid = perfil.id;

  const { data: miembro } = await supa.from("miembros").select("despacho_id").eq("user_id", uid).maybeSingle();
  let despachoId = miembro?.despacho_id ?? null;
  if (!despachoId) {
    const { data: d, error } = await supa.from("despachos")
      .insert({ nombre: "Mi despacho", propietario: uid, plan_hasta, stripe_customer: customer })
      .select("id").single();
    if (error) { console.error("crear despacho:", error); return; }
    despachoId = d.id;
    await supa.from("miembros").insert({ despacho_id: despachoId, user_id: uid, email, rol: "admin" });
  } else {
    const { error } = await supa.from("despachos").update({ plan_hasta, stripe_customer: customer }).eq("id", despachoId);
    if (error) console.error("activar despacho:", error);
  }
  // El que paga figura también como "despacho" en su perfil, para que la app lo muestre.
  await supa.from("perfiles").update({ plan: "despacho", plan_hasta }).eq("id", uid);
}

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let ev: Stripe.Event;
  try {
    ev = await stripe.webhooks.constructEventAsync(body, sig!, Deno.env.get("STRIPE_WEBHOOK_SECRET")!);
  } catch (_e) {
    return new Response("firma inválida", { status: 400 });
  }
  try {
    if (ev.type === "checkout.session.completed") {
      const s = ev.data.object as Stripe.Checkout.Session;
      // amount_subtotal = precio sin impuestos → inmune al IVA que Stripe añada
      await activar(s.customer_details?.email ?? "", s.amount_subtotal ?? s.amount_total ?? 0, ev.type, (s.customer as string) ?? null);
    } else if (ev.type === "invoice.paid") {
      const inv = ev.data.object as Stripe.Invoice;
      await activar(inv.customer_email ?? "", inv.subtotal ?? inv.amount_paid ?? 0, ev.type, (inv.customer as string) ?? null);
    } else if (ev.type === "customer.subscription.deleted") {
      const sub = ev.data.object as Stripe.Subscription;
      const cust = (await stripe.customers.retrieve(sub.customer as string)) as Stripe.Customer;
      if (cust.email) {
        const email = cust.email.trim().toLowerCase();
        await supa.from("perfiles").update({ plan: "demo", plan_hasta: null }).ilike("email", email);
        // Si era un despacho, se cierra la bolsa de horas de todo el equipo.
        await supa.from("despachos").update({ plan_hasta: new Date().toISOString() })
          .eq("stripe_customer", sub.customer as string);
        await registrar(email, ev.type, "demo", 0, sub.customer as string);
      }
    }
  } catch (e) {
    console.error(e);
    return new Response("error interno", { status: 500 });
  }
  return new Response("ok", { status: 200 });
});
