import { landingThemeOptions, type LandingTheme } from '../landing-themes';

export function ThemePicker({
  theme,
  onChange,
}: {
  theme: LandingTheme;
  onChange: (theme: LandingTheme) => void;
}) {
  return (
    <fieldset className="theme-picker" aria-label="Landing theme">
      {landingThemeOptions.map((option) => (
        <button
          key={option.id}
          type="button"
          className="theme-swatch"
          data-theme-swatch={option.id}
          aria-pressed={theme === option.id}
          aria-label={option.label}
          title={option.label}
          onClick={() => onChange(option.id)}
        />
      ))}
    </fieldset>
  );
}
