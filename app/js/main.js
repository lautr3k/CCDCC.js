// check for local file access
if (window.File && window.FileReader && window.FileList && window.Blob) {
    jQuery.event.props.push("dataTransfer");
    $('.__file_support').show();
}

// check for file saver support
try {
    !!new Blob;
    $('.__file_saver_support').show();
} catch (e) {}

// input file handler
function onInputFileChange(e) {
    e.stopPropagation();
    e.preventDefault();
    
    var source = e.dataTransfer || e.target;
    var file   = source.files[0];
    var reader = new FileReader();

    output_filename = file.name;
    var file_ext = output_filename.split('.').pop();
    output_filename = output_filename.replace(file_ext, 'CCDCC.' + file_ext);

    console.log(output_filename)

    reader.onload = function(e) {
        var input = e.target.result;
        $('#input').val(input);
        updateInput();
    };

    reader.readAsText(file);
}

function onDragFileOver(e) {
    e.stopPropagation();
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
}

function openFile(e) {
    $('#inputFile').click()
}

// save file as
function saveFile() {
    saveAs(new Blob([$('#output').val()], {type: "text/plain;charset=utf-8"}), output_filename);
}

// update input value
function updateInput() {
    $('#output').val('');
    ccdcc.setInput($('#input').val());
    $('#input_chars').html(ccdcc.input_chars);
    $('#input_lines').html(ccdcc.input_lines);
    $('#cycles_count').html(ccdcc.cycles_count);
    $('#holes_count').html(ccdcc.holes_count);
    $('#output_chars').html(ccdcc.output_chars);
    $('#output_lines').html(ccdcc.output_lines);
}

// convert
function convert() {
    $('#output').val(ccdcc.convert());
    $('#output_chars').html(ccdcc.output_chars);
    $('#output_lines').html(ccdcc.output_lines);
}

// the converter
var ccdcc = new CCDCC();

// I/O file name
var input_filename  = 'drills.nc';
var output_filename = 'drills.CCDCC.nc';

// load demo file contents
$.get('./nc/' + input_filename, function(data) {
    $('#input').val(data);
    updateInput();
});

// events
$('#input').on('change', updateInput);
$('#inputFile').on('change', onInputFileChange);
$('#inputFile, #input').on('dragover', onDragFileOver);
$('#inputFile, #input').on('drop', onInputFileChange);
$('#convertButton').on('click', convert);
$('#openFileButton').on('click', openFile);
$('#saveFileButton').on('click', saveFile);
$('#dwell').on('change', function(e) {
    ccdcc.dwell_unity = $('#dwell').val();
    convert();
});
$('#clean').on('change', function(e) {
    ccdcc.remove_duplicate = $('#clean').prop('checked');
    convert();
});