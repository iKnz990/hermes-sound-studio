import os

def browser_options():
    options = {'headless': True, 'args': ['--mute-audio']}
    if os.environ.get('BROWSER_EXECUTABLE'):
        options['executable_path'] = os.environ['BROWSER_EXECUTABLE']
    return options
