const MePipeLogo = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {/* Rounded rect TV/screen */}
    <rect x="2" y="3" width="20" height="14" rx="3" />
    {/* Play triangle */}
    <polygon points="10,7 10,13 15,10" fill="currentColor" stroke="none" />
    {/* Pipe/stand */}
    <line x1="8" y1="17" x2="8" y2="21" />
    <line x1="16" y1="17" x2="16" y2="21" />
    <line x1="6" y1="21" x2="18" y2="21" />
  </svg>
);

export default MePipeLogo;
