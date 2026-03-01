/** Large clickable tile for launcher or game. */
export default function Tile({ label, sublabel, image, onClick, size = 'lg' }) {
  const sizeClass = size === 'lg'
    ? 'w-72 h-48'
    : 'w-48 h-64'

  return (
    <div className={`tile ${sizeClass}`} onClick={onClick}>
      {image
        ? <img src={image} alt={label} className="absolute inset-0 w-full h-full object-cover" />
        : <div className="absolute inset-0 bg-gradient-to-br from-steam-hover to-steam-card" />
      }
      <div className="tile-label relative z-10">
        <p className="text-lg font-bold leading-tight">{label}</p>
        {sublabel && <p className="text-xs text-steam-muted mt-0.5">{sublabel}</p>}
      </div>
    </div>
  )
}
