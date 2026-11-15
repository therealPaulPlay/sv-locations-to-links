# Street View locations to links
This project converts coordinate pairs to google streetview embed links using a headless web browser for automation.

## Folder structure
Make sure to create a folder called `input` and one called `output`.

### Input folder
Place valid .json files in the input folder formatted like this: `[
    [
        lat,
        long
    ], 
    [
        lat,
        long
    ]
]`

These files will then be processed and the converted versions will be placed in the output folder.
