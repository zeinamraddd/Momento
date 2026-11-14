import beachImage from "../../assets/momento/shared/illustration-beach.png";

import palmImage from "../../assets/momento/shared/illustration-palm.png";

function AlbumPreview() {

  return (
    <section className="momento-albums-preview">

      <h2>Shared albums</h2>

      <div className="momento-albums-preview__photos">

        {/* First Polaroid */}
        <div className="momento-preview-polaroid momento-preview-polaroid--first">

          <img
            src={beachImage}
            alt="Illustrated beach sunset"
          />

        </div>

        {/* Second Polaroid */}
        <div className="momento-preview-polaroid momento-preview-polaroid--second">

          <img
            src={palmImage}
            alt="Illustrated palm tree on a beach"
          />

        </div>

      </div>

      <button
        type="button"
        className="momento-albums-preview__button"
        disabled
        title="Shared Albums page coming soon"
      >
        Open our albums →
      </button>

    </section>
  );
}

export default AlbumPreview;