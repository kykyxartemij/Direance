// TODO: Write guide about instant navigation and Loading state

// TODO: Try to use Foresight.js to not prefetch everything, and test how it would work, just for testing purposes. Navbar still should be prefetch immediately

logic:
prefetch
→ click
→ layout renders instantly (title)
→ loading.tsx shows instantly (spinner)
→ form renders immediately (empty UI)
→ API call starts
→ data arrives
→ form.reset() fills data
→ UI updates

Loading state:
double loading: loading.tsx + isLoading show <LoadingComponent/>

Global Loading, ArtSkeleton wrap, basekit loading from ArtDataTable -> advantages, low time spending on loading state management