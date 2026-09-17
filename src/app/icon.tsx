import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#171310",
          borderRadius: "7px",
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Camera Body */}
          <path
            d="M4 8H7L8.5 6H15.5L17 8H20C21.1 8 22 8.9 22 10V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V10C2 8.9 2.9 8 4 8Z"
            fill="#FF5C35"
          />
          {/* Lens */}
          <circle cx="12" cy="14" r="3.5" fill="#171310" />
          <circle cx="12" cy="14" r="2" fill="#FFFDF8" />
          {/* Flash */}
          <circle cx="18" cy="11" r="1" fill="#FFFDF8" />
        </svg>
      </div>
    ),
    {
      ...size,
    },
  );
}
