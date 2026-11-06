const Info = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.25}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="11.5" x2="12" y2="16.5" />
    <line x1="12" y1="7.75" x2="12.01" y2="7.75" />
  </svg>
);

export default Info;
