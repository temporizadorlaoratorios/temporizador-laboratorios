import sys
import subprocess

try:
    from PIL import Image
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image

def remove_bg(input_path, output_png, output_ico):
    img = Image.open(input_path).convert("RGBA")
    width, height = img.size
    
    pixels = img.load()
    bg_color = pixels[0, 0]
    
    # Find peak foreground color
    fg_r, fg_g, fg_b = 0, 0, 0
    fg_count = 0
    
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            dist = max(abs(r - bg_color[0]), abs(g - bg_color[1]), abs(b - bg_color[2]))
            if dist > 100:
                fg_r += r
                fg_g += g
                fg_b += b
                fg_count += 1
                
    if fg_count > 0:
        fg_r //= fg_count
        fg_g //= fg_count
        fg_b //= fg_count
    else:
        fg_r, fg_g, fg_b = 255, 0, 255
        
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            dist_bg = ( (r - bg_color[0])**2 + (g - bg_color[1])**2 + (b - bg_color[2])**2 ) ** 0.5
            
            if dist_bg < 40:
                pixels[x, y] = (0, 0, 0, 0)
            elif dist_bg < 120:
                alpha = int((dist_bg - 40) / 80 * 255)
                pixels[x, y] = (fg_r, fg_g, fg_b, alpha)
            else:
                pixels[x, y] = (r, g, b, 255)
                
    img.save(output_png, "PNG")
    
    # Create square version for ICO
    size = max(width, height)
    sq_img = Image.new("RGBA", (size, size), (0,0,0,0))
    sq_img.paste(img, ((size - width) // 2, (size - height) // 2))
    
    icon_sizes = [(16,16), (32, 32), (48, 48), (64,64), (128, 128), (256, 256)]
    sq_img.save(output_ico, format="ICO", sizes=icon_sizes)
    print("Done")

if __name__ == "__main__":
    remove_bg(
        r"C:\Users\usuario1\.gemini\antigravity\brain\68f3c9d7-99a4-468c-bfe4-93dcb2b4171d\fuchsia_refresh_clock_icon_1772882366929.png", 
        r"c:\ARCHIVOS_SHIFT\Temporalizador nuevo\icon_transparente.png",
        r"c:\ARCHIVOS_SHIFT\Temporalizador nuevo\icono.ico"
    )
