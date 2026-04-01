import SearchBar from './SearchBar';
import FilterChips from './FilterChips';
import FilterControls from './FilterControls';
import FilterStatus from './FilterStatus';

const FilterBar = () => {
  return (
    <div className="flex items-center gap-3 w-full p-2 relative z-50">
      <SearchBar />
      <FilterChips />
      <div className="w-px h-6 bg-[var(--border)] mx-2 shrink-0" />
      <FilterControls />
      <FilterStatus />
    </div>
  );
};

export default FilterBar;
