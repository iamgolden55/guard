"""
Management command to load regional compliance data for WorkingHoursRegulation model.
Creates sample data for UK, US, and EU regions with security industry specifics.

Usage:
    python manage.py load_compliance_data
    python manage.py load_compliance_data --force  # Overwrite existing data
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from api.models import WorkingHoursRegulation


class Command(BaseCommand):
    help = 'Load regional compliance data for WorkingHoursRegulation model'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Overwrite existing regulation data',
        )

    def handle(self, *args, **options):
        """Load compliance data for UK, US, and EU regions"""

        self.stdout.write(
            self.style.SUCCESS('Loading regional compliance data...')
        )

        with transaction.atomic():
            # UK Regulation
            uk_data = self.get_uk_regulation_data()
            self.create_or_update_regulation('GB', uk_data, options['force'])

            # US Regulation
            us_data = self.get_us_regulation_data()
            self.create_or_update_regulation('US', us_data, options['force'])

            # EU General Regulation (Germany as example)
            eu_data = self.get_eu_regulation_data()
            self.create_or_update_regulation('DE', eu_data, options['force'])

        self.stdout.write(
            self.style.SUCCESS('Successfully loaded all regional compliance data!')
        )

    def create_or_update_regulation(self, country_code, data, force=False):
        """Create or update a working hours regulation"""

        try:
            regulation = WorkingHoursRegulation.objects.get(country_code=country_code)
            if not force:
                self.stdout.write(
                    self.style.WARNING(
                        f'Regulation for {country_code} already exists. Use --force to overwrite.'
                    )
                )
                return

            # Update existing regulation
            for field, value in data.items():
                setattr(regulation, field, value)
            regulation.save()

            self.stdout.write(
                self.style.SUCCESS(f'Updated regulation for {country_code}')
            )

        except WorkingHoursRegulation.DoesNotExist:
            # Create new regulation
            regulation = WorkingHoursRegulation.objects.create(**data)
            self.stdout.write(
                self.style.SUCCESS(f'Created regulation for {country_code}')
            )

    def get_uk_regulation_data(self):
        """Get UK regulation data with security industry specifics"""
        return {
            'country_code': 'GB',
            'country_name': 'United Kingdom',
            'standard_weekly_hours': 40.0,
            'standard_daily_hours': 8.0,
            'overtime_threshold_hours': 48.0,
            'overtime_multiplier_1': 1.5,
            'max_daily_hours': 12.0,
            'max_weekly_hours': 60.0,  # With opt-out
            'max_consecutive_days': 6,
            'min_rest_between_shifts_hours': 11.0,
            'min_weekly_rest_hours': 24.0,
            'break_duration_minutes': 20,
            'break_trigger_hours': 6.0,
            'regulatory_source': 'UK Health and Safety Executive, Working Time Regulations 1998',
            'security_sector_overrides': {
                'sia_license_required': True,
                'max_consecutive_shifts': 5,
                'enhanced_background_check': True,
                'specialized_training_hours': 40,
                'door_supervisor_additional_hours': 6,
                'cash_in_transit_training': True
            },
            'break_requirements': {
                '6_hours': {
                    'duration_minutes': 20,
                    'paid': True,
                    'mandatory': True,
                    'latest_time': '6_hours_from_start'
                },
                '9_hours': {
                    'duration_minutes': 45,
                    'paid': True,
                    'mandatory': True,
                    'additional_breaks': 1
                },
                '12_hours': {
                    'duration_minutes': 60,
                    'paid': False,
                    'mandatory': True,
                    'meal_break': True
                }
            },
            'night_shift_rules': {
                'max_consecutive_nights': 8,
                'max_night_hours_per_week': 40,
                'max_night_hours_daily': 8,
                'health_assessment_required': True,
                'night_start_time': '23:00',
                'night_end_time': '06:00',
                'enhanced_supervision_required': True
            },
            'opt_out_provisions': {
                'allowed': True,
                'max_weekly_hours': 60,
                'written_agreement_required': True,
                'notice_period_days': 7,
                'health_assessment_required': False,
                'regular_review_required': True,
                'opt_out_form_template': 'UK_WTD_opt_out_form'
            },
            'industry_specific_rules': {
                'risk_assessment_required': True,
                'incident_reporting_mandatory': True,
                'regular_welfare_checks': True,
                'lone_worker_protocols': True,
                'emergency_contact_required': True
            },
            'special_rules': {
                'public_holiday_premium': 1.5,
                'bank_holiday_premium': 2.0,
                'emergency_callout_minimum_hours': 4,
                'travel_time_compensation': True
            }
        }

    def get_us_regulation_data(self):
        """Get US regulation data with state-level variations"""
        return {
            'country_code': 'US',
            'country_name': 'United States',
            'standard_weekly_hours': 40.0,
            'standard_daily_hours': 8.0,
            'overtime_threshold_hours': 40.0,
            'overtime_multiplier_1': 1.5,
            'max_daily_hours': 16.0,  # No federal limit, company policy
            'max_weekly_hours': 80.0,  # No federal limit, company policy
            'max_consecutive_days': 7,
            'min_rest_between_shifts_hours': 8.0,  # Company policy
            'min_weekly_rest_hours': 24.0,  # Company policy
            'break_duration_minutes': 30,
            'break_trigger_hours': 8.0,
            'regulatory_source': 'Fair Labor Standards Act (FLSA), Department of Labor',
            'security_sector_overrides': {
                'security_license_required': True,
                'armed_guard_certification': True,
                'background_check_level': 'federal',
                'firearms_training_hours': 40,
                'annual_recertification': True,
                'drug_testing_required': True
            },
            'break_requirements': {
                '8_hours': {
                    'duration_minutes': 30,
                    'paid': False,
                    'mandatory': False,  # Varies by state
                    'state_variations': True
                },
                '12_hours': {
                    'duration_minutes': 60,
                    'paid': False,
                    'mandatory': False,
                    'recommended': True
                }
            },
            'night_shift_rules': {
                'max_consecutive_nights': 10,
                'max_night_hours_per_week': 50,
                'night_differential': 0.10,  # 10% premium
                'night_start_time': '22:00',
                'night_end_time': '06:00'
            },
            'state_overrides': {
                'CA': {  # California
                    'max_daily_hours': 12.0,
                    'overtime_threshold_daily': 8.0,
                    'double_time_threshold': 12.0,
                    'break_requirements': {
                        '5_hours': {'duration_minutes': 30, 'paid': False, 'mandatory': True},
                        '10_hours': {'duration_minutes': 30, 'paid': False, 'mandatory': True, 'additional': True}
                    },
                    'meal_break_mandatory': True
                },
                'NY': {  # New York
                    'max_daily_hours': 12.0,
                    'spread_of_hours_premium': True,
                    'security_guard_registration': True
                },
                'TX': {  # Texas
                    'no_additional_requirements': True,
                    'private_security_board_license': True
                },
                'FL': {  # Florida
                    'security_officer_license': True,
                    'annual_training_hours': 28
                }
            },
            'industry_specific_rules': {
                'federal_background_check': True,
                'state_licensing_compliance': True,
                'client_specific_training': True,
                'incident_documentation': True,
                'chain_of_custody_training': True
            }
        }

    def get_eu_regulation_data(self):
        """Get EU regulation data (Germany as example) with Working Time Directive compliance"""
        return {
            'country_code': 'DE',
            'country_name': 'Germany',
            'standard_weekly_hours': 40.0,
            'standard_daily_hours': 8.0,
            'overtime_threshold_hours': 48.0,
            'overtime_multiplier_1': 1.25,
            'max_daily_hours': 10.0,  # Can extend to 10 if averaged over 6 months
            'max_weekly_hours': 48.0,
            'max_consecutive_days': 6,
            'min_rest_between_shifts_hours': 11.0,
            'min_weekly_rest_hours': 35.0,  # Includes Sunday rest
            'break_duration_minutes': 30,
            'break_trigger_hours': 6.0,
            'regulatory_source': 'EU Working Time Directive 2003/88/EC, German Working Time Act (ArbZG)',
            'security_sector_overrides': {
                'gewerbeordnung_compliance': True,  # German trade regulation
                'security_industry_certification': True,
                'background_check_required': True,
                'specialist_security_training': 40,
                'regular_competency_assessment': True
            },
            'break_requirements': {
                '6_hours': {
                    'duration_minutes': 30,
                    'paid': True,
                    'mandatory': True,
                    'uninterrupted': True
                },
                '9_hours': {
                    'duration_minutes': 45,
                    'paid': True,
                    'mandatory': True,
                    'split_allowed': False
                }
            },
            'night_shift_rules': {
                'max_consecutive_nights': 8,
                'max_night_hours_per_week': 40,
                'max_night_hours_daily': 8,
                'health_assessment_required': True,
                'night_start_time': '23:00',
                'night_end_time': '06:00',
                'night_work_premium': 0.25,
                'health_monitoring_required': True
            },
            'opt_out_provisions': {
                'allowed': False,  # Germany doesn't allow individual opt-outs
                'collective_agreement_possible': True,
                'sector_specific_agreements': True,
                'emergency_services_exception': True
            },
            'industry_specific_rules': {
                'works_council_notification': True,
                'health_safety_documentation': True,
                'mandatory_time_recording': True,  # New German law
                'data_protection_compliance': True,
                'eu_privacy_regulation': True
            },
            'special_rules': {
                'sunday_work_restrictions': True,
                'public_holiday_restrictions': True,
                'collective_bargaining_precedence': True,
                'works_council_involvement': True
            }
        }