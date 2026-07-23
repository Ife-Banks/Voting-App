// Run with: npx tsx scripts/test-email-fallback.ts <count> <email>
// Example:  npx tsx scripts/test-email-fallback.ts 120 you@gmail.com
//
// Sends <count> real test emails through the exact same sendEmail() function
// the app uses, logging which provider handled each one. Use a Gmail "+alias"
// address (you+test1@gmail.com works, but here we just reuse one inbox — Gmail
// ignores the +suffix so they all land in the same place) so you don't have to
// juggle multiple test mailboxes.
//
// IMPORTANT: this consumes real quota on Resend/Brevo/Mailjet. Run it a few
// days before voting opens, never on election day itself.

import { config } from 'dotenv'
config({ path: '.env.local' })
import { sendEmail } from '../lib/email-service'

async function main() {
  const count = parseInt(process.argv[2] ?? '50', 10)
  const to = process.argv[3]

  if (!to) {
    console.error('Usage: npx tsx scripts/test-email-fallback.ts <count> <email>')
    process.exit(1)
  }

  console.log(`Sending ${count} test emails to ${to}...\n`)

  const tally: Record<string, number> = { resend: 0, brevo: 0, mailjet: 0, failed: 0 }

  for (let i = 1; i <= count; i++) {
    const { success, provider } = await sendEmail({
      to,
      subject: `Fallback test #${i}`,
      html: `<p>Test email #${i} of ${count}.</p>`,
      text: `Test email #${i} of ${count}.`,
      purpose: 'test',
    })

    if (success && provider) {
      tally[provider]++
      console.log(`#${i}: sent via ${provider}`)
    } else {
      tally.failed++
      console.log(`#${i}: ALL PROVIDERS FAILED`)
    }

    // Small delay so you can watch it happen live rather than blasting all at once.
    await new Promise(res => setTimeout(res, 300))
  }

  console.log('\n--- Summary ---')
  console.log(tally)
  console.log(
    `\nIf you see a run of "resend" entries followed by a switch to "brevo" (and eventually` +
    ` "mailjet" if you push count high enough), the fallback chain is proven to work end-to-end` +
    ` against real provider limits, not just in theory.`
  )
}

main()
