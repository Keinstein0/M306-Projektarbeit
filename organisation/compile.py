#######################################################
# This code compiles the contents of documentation.md #
# into a readable word file. Code by Google Gemini    #
# Prompt:                                             #
#i have a markdown flie which i'd like to convert to a#
#word file. The thing i'd need would have to ideally  #
#be executable in the directory so it knows where the #
#images live. I'd love for it to be highly            #
#customizable so that i can set things like a fix     #
#cover page and have it autogenerate an index of all  #
#of the things as well as set headers and footers and #
#i'd like to have that in a file so that i don't have #
# to configure it every single time                   #
#######################################################

# !choco install pandoc
# to run -> python compile.py


#!/usr/bin/env python3
import subprocess
import os
import sys

def compile_markdown(input_file="document.md", output_file="output.docx"):
    # Ensure dependencies are present
    if not os.path.exists("defaults.yaml"):
        print("Error: 'defaults.yaml' configuration file not found.")
        sys.exit(1)
        
    if not os.path.exists("reference.docx"):
        print("Warning: 'reference.docx' style master missing. Generating a default template...")
        subprocess.run("pandoc --print-default-data-file=reference.docx > reference.docx", shell=True)

    print(f"Compiling '{input_file}' into '{output_file}' using local configurations...")
    
    # Run pandoc using the configuration file
    cmd = [
        "pandoc",
        input_file,
        "-o", output_file,
        "--defaults=defaults.yaml"
    ]
    
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print("✅ Document successfully compiled!")
        print(f"📍 Location: {os.path.abspath(output_file)}")
    except subprocess.CalledProcessError as e:
        print("❌ Compilation failed.")
        print(e.stderr)
    except FileNotFoundError:
        print("❌ Error: Pandoc is not installed on your system path. Please install Pandoc via Homebrew, Choco, or apt.")

if __name__ == "__main__":
    # Allows usage: python compile.py custom.md final.docx
    infile = sys.argv[1] if len(sys.argv) > 1 else "documentation.md"
    outfile = sys.argv[2] if len(sys.argv) > 2 else "LB_306_Satellitenprojekt.docx"
    compile_markdown(infile, outfile)