# Generated migration for WebSocket support

from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0026_add_reporting_indexes'),
    ]

    operations = [
        migrations.AddField(
            model_name='reportjob',
            name='progress',
            field=models.IntegerField(default=0, help_text='Report generation progress percentage (0-100)', validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(100)]),
        ),
    ]