import Link from 'next/link';

export default function SignUpPage() {
  return (
    <>
      <h1 className="mb-3 text-xl font-semibold" style={{ color: 'var(--text)' }}>
        Access is invite-only
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
        New accounts are created by invitation only. Contact your administrator to receive an invite link.
      </p>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Already have an account?{' '}
        <Link href="/auth/sign-in" prefetch style={{ color: 'var(--primary)' }}>
          Sign in
        </Link>
      </p>
    </>
  );
}
