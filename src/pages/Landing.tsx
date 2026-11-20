import { Logo } from '../components/ui';
import { lastShop } from '../lib/api';

const STEPS = [
  { t: 'Share "something like this"', d: 'The customer drops reference photos from Pinterest or Instagram into the brief room, or adds any photo from the chat with one tap.' },
  { t: 'Point at exactly what you mean', d: 'Drag over any part of the photo: keep this, change the colour to this pink, remove that, add this text. Every pin lands in the chat.' },
  { t: 'Lock the details', d: 'Size, flavour, message, delivery date and quoted price go into a structured spec, so nothing is buried in chat scroll.' },
  { t: 'Both approve the same version', d: 'The brief is frozen as version 3 with a fingerprint. When both sides approve it, it becomes the work order. No "but I said…".' },
];

const FEATURES = [
  { e: '📍', t: 'Region pins', d: 'Talk about a specific flower, not "the thing on the left".' },
  { e: '🎨', t: 'Colour picks', d: 'Exact hex colours instead of "light pink but not too light".' },
  { e: '🧾', t: 'Structured spec', d: 'Required fields block approval until the brief is complete.' },
  { e: '🔁', t: 'Versions & diffs', d: 'See exactly what changed between v2 and v3.' },
  { e: '🤝', t: 'Dual approval', d: 'Agreement only when both approve the same hashed version.' },
  { e: '💬', t: 'Chat stays attached', d: 'Every pin, version and approval appears as a card in the conversation.' },
  { e: '📥', t: 'Seller inbox', d: 'All customer conversations and order statuses in one dashboard.' },
  { e: '🖨️', t: 'Work order PDF', d: 'Print the agreed brief for the kitchen or workshop.' },
];

export default function Landing() {
  const shop = lastShop();
  return (
    <div>
      <nav className="nav">
        <Logo />
        <span className="spacer" />
        <a className="hide-sm muted" href="#how">
          How it works
        </a>
        {shop ? (
          <a className="btn ghost sm" href={`/seller/${shop}`}>
            My dashboard
          </a>
        ) : (
          <a className="btn ghost sm" href="/start">
            For sellers
          </a>
        )}
      </nav>

      <header className="hero">
        <div>
          <span className="chip agreed">For custom cakes, merch & furniture</span>
          <h1>
            From <em>“something like this”</em> to exactly what we agreed to make.
          </h1>
          <p className="lead">
            BriefRoom turns a customer's vague reference photo into a clear, versioned visual brief that buyer and seller both approve, with the
            whole conversation attached.
          </p>
          <div className="row wrap">
            <a className="btn lg" href="/start">
              Create your free shop →
            </a>
            <a className="btn lg ghost" href="#how">
              See how it works
            </a>
          </div>
          <p className="faint" style={{ fontSize: 13, marginTop: 14 }}>
            No app to install. Customers open a link, sellers get a dashboard.
          </p>
        </div>
        <div className="hero-art">
          <div className="card mock">
            <div className="mock-img">
              🎂
              <div className="mock-pin" style={{ left: '22%', top: '14%', width: '30%', height: '24%', borderColor: '#c026d3' }}>
                <span style={{ background: '#c026d3' }}>1</span>
              </div>
              <div className="mock-pin" style={{ left: '56%', top: '52%', width: '28%', height: '22%', borderColor: '#d97706' }}>
                <span style={{ background: '#d97706' }}>2</span>
              </div>
              <div className="mock-pin" style={{ left: '14%', top: '60%', width: '22%', height: '20%', borderColor: '#16a34a' }}>
                <span style={{ background: '#16a34a' }}>3</span>
              </div>
            </div>
            <div style={{ padding: '12px 4px 2px', fontSize: 14 }}>
              <div>
                <b style={{ color: '#c026d3' }}>#1</b> 🎨 Flowers in <span className="swatch" style={{ background: '#f4a7c0' }} />
                <span className="mono">#f4a7c0</span>
              </div>
              <div>
                <b style={{ color: '#d97706' }}>#2</b> 🔤 “Happy 25th, Aditi”
              </div>
              <div>
                <b style={{ color: '#16a34a' }}>#3</b> ✅ Keep the gold drip exactly
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <span className="chip agreed">🤝 Version 3 agreed · ₹1,850</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="section">
        <h2>Custom orders break in the chat</h2>
        <p className="muted" style={{ maxWidth: 680 }}>
          A home baker gets a screenshot and "make it like this but pink". Forty WhatsApp messages later, nobody remembers which pink, which
          size, or whether the price included the topper. The cake arrives, and the customer says "that's not what I asked for".
        </p>
        <div className="compare" style={{ marginTop: 18 }}>
          <div className="card">
            <b>😩 The WhatsApp way</b>
            <ul>
              <li>Screenshots and voice notes scattered across days</li>
              <li>"The flowers on the left" means different things to each person</li>
              <li>Price and date agreed somewhere in message 27</li>
              <li>No record of what was actually confirmed</li>
              <li>Remakes, refunds and 1-star reviews</li>
            </ul>
          </div>
          <div className="card" style={{ borderColor: '#b7e4c7' }}>
            <b>😌 The BriefRoom way</b>
            <ul>
              <li>One room per order: chat on the left, brief on the right</li>
              <li>Pins on the exact part of the photo, with exact colours</li>
              <li>Size, flavour, message, date and price in one checklist</li>
              <li>Both approve the same frozen version, with a fingerprint</li>
              <li>A printable work order the kitchen can follow</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <h2>How it works</h2>
        <div className="grid-4" style={{ marginTop: 18 }}>
          {STEPS.map((s, i) => (
            <div className="card step" key={s.t}>
              <div className="n">{i + 1}</div>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Everything a custom order needs, nothing it doesn't</h2>
        <div className="grid-4" style={{ marginTop: 18 }}>
          {FEATURES.map((f) => (
            <div className="card step" key={f.t}>
              <div style={{ fontSize: 26 }}>{f.e}</div>
              <h3>{f.t}</h3>
              <p>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" style={{ textAlign: 'center' }}>
        <div className="card" style={{ padding: 34, background: 'linear-gradient(135deg, #fdebe4, #fff8f1)' }}>
          <h2>Fewer clarification messages. Fewer wrong orders.</h2>
          <p className="muted">Free for home bakers and small studios. Set up your shop link in 20 seconds.</p>
          <a className="btn lg" href="/start">
            Create your free shop →
          </a>
        </div>
      </section>
      <footer className="footer">
        BriefRoom · real-time conversations by Nexconn Chat SDK & Chat UI · <a href="/stats">live usage</a>
      </footer>
    </div>
  );
}
