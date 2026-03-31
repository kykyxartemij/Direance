const Dislike = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M17 2v11h5V2h-5Z" />
    <path d="M17 13l-3 7a2 2 0 0 1-2 2h-.5a2 2 0 0 1-2-2v-4H5a2 2 0 0 1-2-2.2l1.4-8A2 2 0 0 1 6.4 4H17" />
  </svg>
);

export default Dislike;
