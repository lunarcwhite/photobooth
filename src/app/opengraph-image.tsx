import { ImageResponse } from "next/og";

export const alt = "Booth Kecil untuk Berdua — Photobooth Online";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          backgroundColor: "#F7F4EE",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "50px 75px",
          border: "14px solid #EAE3D6",
          boxSizing: "border-box",
        }}
      >
        {/* Sisi Kiri: Branding & Informasi */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            maxWidth: "660px",
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "#171310",
              color: "#FFFDF8",
              padding: "7px 18px",
              borderRadius: "999px",
              fontSize: "17px",
              fontWeight: 700,
              letterSpacing: "0.06em",
              alignSelf: "flex-start",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                width: "9px",
                height: "9px",
                borderRadius: "50%",
                backgroundColor: "#FF5C35",
                display: "flex",
              }}
            />
            <span>PHOTOBOOTH ONLINE UNTUK DUA ORANG</span>
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: "54px",
              fontWeight: 900,
              color: "#171310",
              lineHeight: 1.15,
              marginBottom: "18px",
              letterSpacing: "-0.02em",
            }}
          >
            Booth Kecil untuk Berdua
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: "23px",
              color: "#77736B",
              lineHeight: 1.45,
              marginBottom: "32px",
            }}
          >
            Bikin foto strip estetik bareng teman atau pasangan dari mana saja.
            Bisa remote dua HP berjauhan atau satu HP bareng!
          </div>

          {/* Feature Pills */}
          <div
            style={{
              display: "flex",
              gap: "14px",
              fontSize: "18px",
              fontWeight: 700,
              color: "#FF5C35",
            }}
          >
            <span>• Tanpa Aplikasi</span>
            <span style={{ color: "#DDD8CE" }}>|</span>
            <span>• Tanpa Daftar</span>
            <span style={{ color: "#DDD8CE" }}>|</span>
            <span>• Gratis 100%</span>
          </div>
        </div>

        {/* Sisi Kanan: Visual Mockup Strip Photobooth */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#FFFDF8",
            border: "2px solid #DDD8CE",
            borderRadius: "18px",
            padding: "20px 18px 16px",
            width: "270px",
            boxShadow: "0 22px 40px rgba(23,19,16,0.16)",
            alignItems: "center",
            transform: "rotate(3deg)",
          }}
        >
          <div
            style={{
              fontSize: "16px",
              fontWeight: 800,
              color: "#171310",
              marginBottom: "12px",
              letterSpacing: "0.12em",
            }}
          >
            OUR MOMENT
          </div>

          {/* 3 mini photo boxes */}
          <div
            style={{
              display: "flex",
              width: "230px",
              height: "102px",
              backgroundColor: "#FFE5DD",
              borderRadius: "10px",
              border: "1px solid #E8D4CC",
              marginBottom: "10px",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "30px",
            }}
          >
            🫶
          </div>
          <div
            style={{
              display: "flex",
              width: "230px",
              height: "102px",
              backgroundColor: "#E4EDE6",
              borderRadius: "10px",
              border: "1px solid #D2DFD5",
              marginBottom: "10px",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "30px",
            }}
          >
            ✌️
          </div>
          <div
            style={{
              display: "flex",
              width: "230px",
              height: "102px",
              backgroundColor: "#F3EDE1",
              borderRadius: "10px",
              border: "1px solid #E2D7C5",
              marginBottom: "10px",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "30px",
            }}
          >
            ✨
          </div>

          {/* Footer mini */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginTop: "4px",
              fontSize: "13px",
              fontWeight: 700,
              color: "#171310",
            }}
          >
            <span>Kamu & Teman</span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 500,
                color: "#77736B",
                marginTop: "2px",
              }}
            >
              boothkecil.vercel.app
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
